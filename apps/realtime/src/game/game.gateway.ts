import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { FirebaseService } from '../firebase/firebase.service';
import { GameStateManager } from './game-state.manager';
import { GameRoomManager } from './game-room.manager';
import { AuthenticatedSocket, createWsAuthMiddleware } from '../auth/ws-auth.middleware';
import { Session, WsGameStatePayload, WsMovePayload, getGameInfo } from '@weekly-arcade/shared';

const ALLOWED_ORIGINS = [
  'http://localhost:4200',
  'http://localhost:4201',
  'http://localhost:4321',
  'http://localhost:5000',
  'https://weeklyarcade.games',
  'https://www.weeklyarcade.games',
  'https://weekly-arcade.web.app',
  'https://weekly-arcade.firebaseapp.com',
  'https://loyal-curve-425715-h6.web.app',
  'https://loyal-curve-425715-h6.firebaseapp.com',
];

@WebSocketGateway({
  namespace: '/game',
  cors: { origin: ALLOWED_ORIGINS, credentials: true },
  pingInterval: 15000,
  pingTimeout: 45000,
})
export class GameGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(GameGateway.name);

  // Turn timeout timers: sessionId → NodeJS.Timeout
  private turnTimers = new Map<string, NodeJS.Timeout>();
  // Consecutive timeout count per player: `sessionId:uid` → count
  private timeoutCounts = new Map<string, number>();
  private readonly MAX_CONSECUTIVE_TIMEOUTS = 3;

  // Throttled activity tracking: sessionId → last Firestore write timestamp
  private lastActivityWrite = new Map<string, number>();
  private readonly ACTIVITY_WRITE_INTERVAL_MS = 30_000; // Write at most once per 30s per session

  // Periodic heartbeat interval
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private readonly HEARTBEAT_INTERVAL_MS = 30_000;

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly firebase: FirebaseService,
    private readonly stateManager: GameStateManager,
    private readonly roomManager: GameRoomManager,
  ) {}

  afterInit(server: Server) {
    // Attach auth middleware to the namespace
    server.use(createWsAuthMiddleware(this.firebase));
    this.logger.log('Game gateway initialized with auth middleware');

    // Periodic heartbeat: update lastHeartbeat for all connected players
    this.heartbeatInterval = setInterval(() => this._heartbeatAll(), this.HEARTBEAT_INTERVAL_MS);
  }

  // ─── Connection lifecycle ───────────────────────────────────────────

  async handleConnection(client: AuthenticatedSocket) {
    const { uid } = client.data.user;
    const { sessionId } = client.data;

    try {
      // Verify player is a participant in this session
      const sessionDoc = await this.firebase.doc(`sessions/${sessionId}`).get();
      if (!sessionDoc.exists) {
        client.emit('error', { code: 'SESSION_NOT_FOUND', message: 'Session does not exist' });
        client.disconnect();
        return;
      }

      const session = sessionDoc.data() as Session;

      // Reject connections to finished/abandoned sessions
      if (session.status === 'finished' || session.status === 'abandoned') {
        client.emit('error', { code: 'SESSION_ENDED', message: 'This game has already ended' });
        client.disconnect();
        return;
      }

      const player = session.players?.[uid];

      // Allow participants and spectators
      const isParticipant = !!player && player.status !== 'left';
      const isSpectator = session.spectatorAllowed && !isParticipant;

      if (!isParticipant && !isSpectator) {
        client.emit('error', { code: 'NOT_PARTICIPANT', message: 'Not a participant in this session' });
        client.disconnect();
        return;
      }

      // Load session into memory if not already
      await this.stateManager.loadSession(sessionId);

      // Join Socket.IO room
      const roomName = `session:${sessionId}`;
      client.join(roomName);
      this.roomManager.addClient(sessionId, uid, client.id, isSpectator);

      if (isParticipant) {
        this.stateManager.addPlayer(sessionId, uid);

        // Update player status in Firestore
        await this.firebase.doc(`sessions/${sessionId}`).update({
          [`players.${uid}.status`]: 'connected',
          [`players.${uid}.lastHeartbeat`]: new Date(),
          lastActivityAt: new Date(),
        });

        // Notify other players that this player joined/reconnected.
        // For the host, use ack+retry so the event isn't silently lost
        // (e.g., host's socket recovering from a background suspension on mobile).
        const wasDisconnected = player?.status === 'disconnected';
        const eventName = wasDisconnected ? 'session:player-reconnected' : 'session:player-joined';
        const eventData = { uid, displayName: player?.displayName || '', avatarUrl: player?.avatarUrl || null };

        // Broadcast to non-host players (spectators, etc.)
        client.to(roomName).emit(eventName, eventData);

        // Ack+retry for the host — if host missed the broadcast, deliver directly
        if (!wasDisconnected && session.hostUid && session.hostUid !== uid) {
          this.emitWithAck(sessionId, session.hostUid, eventName, eventData);
        }
      }

      // Send current game state to the connecting client (if game already started)
      const activeSession = this.stateManager.getSession(sessionId);
      if (activeSession && activeSession.version > 0) {
        const turnUid = this.stateManager.getNextTurn(sessionId);
        const payload: WsGameStatePayload = {
          state: activeSession.state,
          version: activeSession.version,
          turnUid,
        };
        client.emit('game:state', payload);
      }

      this.logger.log(`${isSpectator ? 'Spectator' : 'Player'} connected: uid=${uid} session=${sessionId}`);

      // Auto-ready on connect and try to start if all players are in
      if (isParticipant) {
        this.roomManager.markReady(sessionId, uid);
        await this.tryStartGame(sessionId, roomName);
      }
    } catch (error) {
      this.logger.error(`Connection error: ${(error as Error).message}\n${(error as Error).stack}`);
      client.emit('error', { code: 'CONNECTION_ERROR', message: (error as Error).message });
      client.disconnect();
    }
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    if (!client.data?.user) return; // Auth failed, nothing to clean up

    const { uid } = client.data.user;
    const { sessionId } = client.data;

    this.stateManager.removePlayer(sessionId, uid);
    const wasSpectator = this.roomManager.isSpectator(sessionId, client.id);
    this.roomManager.removeClient(sessionId, client.id);

    if (!wasSpectator) {
      // Update player status in Firestore
      try {
        await this.firebase.doc(`sessions/${sessionId}`).update({
          [`players.${uid}.status`]: 'disconnected',
          lastActivityAt: new Date(),
        });
      } catch {
        // Session may already be cleaned up
      }

      // Broadcast disconnect
      const roomName = `session:${sessionId}`;
      client.to(roomName).emit('session:player-left', { uid, reason: 'disconnected' });

      // Check remaining connected players
      const connectedPlayers = this.roomManager.getConnectedPlayers(sessionId);
      if (connectedPlayers.length === 0) {
        // Check session status before abandoning — 'waiting' sessions should
        // survive disconnects (host may have backgrounded to share invite link)
        const sessionDoc = await this.firebase.doc(`sessions/${sessionId}`).get();
        const sessionStatus = sessionDoc.exists ? (sessionDoc.data() as Session).status : null;

        if (sessionStatus === 'waiting' || sessionStatus === 'starting') {
          // Don't abandon — 'waiting' means host may have backgrounded to share
          // invite link; 'starting' is a brief init window where a network blip
          // could disconnect both. Cleanup cron will expire if nobody reconnects.
          this.logger.log(`All players disconnected from ${sessionStatus} session ${sessionId} — keeping alive for reconnect`);
        } else {
          // Active/playing game with no players — abandon immediately
          this.logger.log(`All players left session ${sessionId} — abandoning`);
          this.clearTurnTimer(sessionId);
          try {
            await this.firebase.doc(`sessions/${sessionId}`).update({
              status: 'abandoned',
              finishedAt: new Date(),
            });
            this.stateManager.evictSession(sessionId);
            this.lastActivityWrite.delete(sessionId);
          } catch {
            // Already cleaned up
          }
        }
      } else if (connectedPlayers.length === 1) {
        // One player left during an active game — give 2 min reconnect window
        // After that, the remaining player wins by abandonment
        const activeSession = this.stateManager.getSession(sessionId);
        if (activeSession && activeSession.version > 0) {
          this.logger.log(`Player ${uid} left active game ${sessionId} — 2 min reconnect window`);
          const disconnectedUid = uid;
          const remainingUid = connectedPlayers[0];

          setTimeout(async () => {
            // Check if the player reconnected
            const currentConnected = this.roomManager.getConnectedPlayers(sessionId);
            if (!currentConnected.includes(disconnectedUid)) {
              this.logger.log(`Player ${disconnectedUid} did not reconnect — ${remainingUid} wins`);
              this.clearTurnTimer(sessionId);
              const results: Record<string, { score: number; rank: number; outcome: 'win' | 'loss' | 'draw' }> = {};
              results[disconnectedUid] = { score: 0, rank: 2, outcome: 'loss' };
              results[remainingUid] = { score: 0, rank: 1, outcome: 'win' };
              await this.handleGameFinished(sessionId, { players: results, reason: 'disconnect' });
            }
          }, 120_000); // 2 minute reconnect window
        }
      }
    }

    this.logger.log(`${wasSpectator ? 'Spectator' : 'Player'} disconnected: uid=${uid} session=${sessionId}`);
  }

  // ─── Game events ────────────────────────────────────────────────────

  @SubscribeMessage('game:move')
  async handleMove(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: WsMovePayload,
  ) {
    const { uid } = client.data.user;
    const { sessionId } = client.data;

    // Spectators cannot submit moves
    if (this.roomManager.isSpectator(sessionId, client.id)) {
      client.emit('game:move-rejected', { reason: 'Spectators cannot make moves' });
      return;
    }

    try {
      const { state, version, gameResult } = this.stateManager.applyMove(
        sessionId,
        uid,
        payload.moveType,
        payload.moveData,
      );

      // Player made a real move — reset their timeout counter
      this.timeoutCounts.delete(`${sessionId}:${uid}`);

      // Update session activity + player heartbeat (throttled)
      this._updateSessionActivity(sessionId, uid);

      const turnUid = gameResult ? null : this.stateManager.getNextTurn(sessionId);

      // Broadcast new state to all clients in the room
      const roomName = `session:${sessionId}`;
      const statePayload: WsGameStatePayload = { state, version, turnUid };
      this.server.to(roomName).emit('game:state', statePayload);

      // If game is over, handle finish
      if (gameResult) {
        this.clearTurnTimer(sessionId);
        await this.handleGameFinished(sessionId, gameResult);
      } else if (turnUid) {
        // Restart turn timer for the next player (120s default)
        this.startTurnTimer(sessionId, turnUid, 120);
      }
    } catch (error) {
      this.logger.warn(`Move rejected for ${uid} in ${sessionId}: ${payload.moveType} — ${(error as Error).message}`);
      client.emit('game:move-rejected', { reason: (error as Error).message });
    }
  }

  @SubscribeMessage('game:ready')
  async handleReady(@ConnectedSocket() client: AuthenticatedSocket) {
    const { uid } = client.data.user;
    const { sessionId } = client.data;
    const roomName = `session:${sessionId}`;

    this.roomManager.markReady(sessionId, uid);
    client.to(roomName).emit('session:player-ready', { uid });

    this.logger.debug(`Player ready: uid=${uid} session=${sessionId}`);

    // Check if we should start the game
    await this.tryStartGame(sessionId, roomName);
  }

  @SubscribeMessage('game:host-start')
  async handleHostStart(@ConnectedSocket() client: AuthenticatedSocket) {
    const { uid } = client.data.user;
    const { sessionId } = client.data;
    const roomName = `session:${sessionId}`;

    // Verify this is the host
    const sessionDoc = await this.firebase.doc(`sessions/${sessionId}`).get();
    if (!sessionDoc.exists) return;
    const session = sessionDoc.data() as Session;
    if (session.hostUid !== uid) {
      client.emit('error', { code: 'NOT_HOST', message: 'Only the host can start the game' });
      return;
    }

    this.logger.log(`Host manually starting session ${sessionId}`);
    await this.tryStartGame(sessionId, roomName, true);
  }

  /**
   * Check if all connected players are ready and start the game.
   * Auto-transitions 'waiting' → 'starting' → 'playing' when all players are in,
   * so the game starts even if the host client missed the player-joined event
   * (common on mobile when the host backgrounds the app to share an invite link).
   */
  private async tryStartGame(sessionId: string, roomName: string, manualTrigger = false): Promise<void> {
    const activeSession = this.stateManager.getSession(sessionId);
    if (!activeSession || activeSession.version > 0) return; // Already initialized

    // Read session from Firestore to check status
    const sessionDoc = await this.firebase.doc(`sessions/${sessionId}`).get();
    if (!sessionDoc.exists) return;
    const session = sessionDoc.data() as Session;

    // Need at least minPlayers connected
    const connectedPlayers = this.roomManager.getConnectedPlayers(sessionId);
    if (connectedPlayers.length < session.minPlayers) return;

    // Session must not be finished or abandoned
    if (session.status === 'finished' || session.status === 'abandoned') return;

    // For autoStart games: auto-transition waiting → starting when all players ready
    // For manual-start games (manualTrigger=false): skip. Host triggers via game:host-start (manualTrigger=true)
    const gameInfo = getGameInfo(session.gameId);
    const isAutoStart = gameInfo?.multiplayer?.autoStart !== false;

    if (session.status === 'waiting') {
      if (!isAutoStart && !manualTrigger) return;

      if (isAutoStart) {
        // All connected players must be ready for auto-start
        const readyPlayers = this.roomManager.getReadyPlayers(sessionId);
        const allReady = connectedPlayers.every(uid => readyPlayers.includes(uid));
        if (!allReady) return;
      }

      this.logger.log(`${manualTrigger ? 'Manual' : 'Auto'}-starting session ${sessionId}: ${connectedPlayers.length} players connected`);
      await this.firebase.doc(`sessions/${sessionId}`).update({
        status: 'starting',
        lastActivityAt: new Date(),
      });
    }

    // Initialize game state
    try {
      const playerUids = Object.keys(session.players).filter(
        uid => session.players[uid].status !== 'left'
      );
      const state = await this.stateManager.initializeGame(
        sessionId, playerUids, session.gameConfig || {}
      );

      // Update Firestore to playing
      if (session.status !== 'playing') {
        await this.firebase.doc(`sessions/${sessionId}`).update({
          status: 'playing',
          startedAt: new Date(),
          lastActivityAt: new Date(),
        });
      }

      // Broadcast initial state to all players
      const turnUid = this.stateManager.getNextTurn(sessionId);
      const payload: WsGameStatePayload = {
        state,
        version: 1,
        turnUid,
      };
      this.server.to(roomName).emit('game:state', payload);

      // Start turn timer for the first player
      if (turnUid) {
        this.startTurnTimer(sessionId, turnUid, 120);
      }

      this.logger.log(`Game started: session=${sessionId} players=${playerUids.join(',')}`);
    } catch (error) {
      this.logger.error(`Failed to start game: ${(error as Error).message}`);
      this.server.to(roomName).emit('error', {
        code: 'GAME_START_FAILED',
        message: 'Failed to initialize the game. Please try again.',
      });
    }
  }

  @SubscribeMessage('game:forfeit')
  async handleForfeit(@ConnectedSocket() client: AuthenticatedSocket) {
    const { uid } = client.data.user;
    const { sessionId } = client.data;

    this.logger.log(`Player forfeited: uid=${uid} session=${sessionId}`);
    this.clearTurnTimer(sessionId);

    // Get other players to determine winner
    const session = this.stateManager.getSession(sessionId);
    if (!session) return;

    const otherPlayers = Array.from(session.players).filter(p => p !== uid);
    const results: Record<string, { score: number; rank: number; outcome: 'win' | 'loss' | 'draw' }> = {};

    results[uid] = { score: 0, rank: otherPlayers.length + 1, outcome: 'loss' };
    otherPlayers.forEach((p, i) => {
      results[p] = { score: 0, rank: i + 1, outcome: 'win' };
    });

    await this.handleGameFinished(sessionId, { players: results, reason: 'forfeit' });
  }

  @SubscribeMessage('auth:refresh')
  handleAuthRefresh(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { token: string },
  ) {
    // Token refresh — re-verify and update socket data
    this.firebase.verifyIdToken(payload.token)
      .then(decoded => {
        client.data.user = { uid: decoded.uid, email: decoded.email || '' };
        this.logger.debug(`Token refreshed for uid=${decoded.uid}`);
      })
      .catch(() => {
        client.emit('error', { code: 'AUTH_REFRESH_FAILED', message: 'Token refresh failed' });
      });
  }

  // ─── Private helpers ────────────────────────────────────────────────

  /**
   * Start/restart the turn timer for a session.
   * When the timer expires, make a random legal move for the timed-out player
   * (skip their turn gracefully instead of instant loss).
   */
  private startTurnTimer(sessionId: string, turnUid: string | null, timeoutSec: number): void {
    this.clearTurnTimer(sessionId);
    if (!turnUid || !timeoutSec) return;

    this.turnTimers.set(sessionId, setTimeout(async () => {
      const timeoutKey = `${sessionId}:${turnUid}`;
      const count = (this.timeoutCounts.get(timeoutKey) || 0) + 1;
      this.timeoutCounts.set(timeoutKey, count);

      const roomName = `session:${sessionId}`;

      // After 3 consecutive timeouts, forfeit the AFK player
      if (count >= this.MAX_CONSECUTIVE_TIMEOUTS) {
        this.logger.log(`AFK forfeit: ${turnUid} in session ${sessionId} — ${count} consecutive timeouts`);
        this.server.to(roomName).emit('game:turn-timeout', { uid: turnUid, action: 'forfeit', count });

        const session = this.stateManager.getSession(sessionId);
        if (!session) return;
        const otherPlayers = Array.from(session.players).filter(p => p !== turnUid);
        const results: Record<string, { score: number; rank: number; outcome: 'win' | 'loss' | 'draw' }> = {};
        results[turnUid] = { score: 0, rank: 2, outcome: 'loss' };
        otherPlayers.forEach((p, i) => { results[p] = { score: 0, rank: 1, outcome: 'win' }; });
        this.clearTurnTimer(sessionId);
        await this.handleGameFinished(sessionId, { players: results, reason: 'timeout' });
        return;
      }

      this.logger.log(`Turn timeout: ${turnUid} in session ${sessionId} — auto-move (${count}/${this.MAX_CONSECUTIVE_TIMEOUTS})`);

      try {
        // Get the current game state and find a random legal move
        const session = this.stateManager.getSession(sessionId);
        if (!session || !session.state) return;

        const state = session.state as any;
        if (!state.fen) return;

        // Use the chess engine to find legal moves
        const { ChessEngine: ChessEngineClass } = await import('./game-logic/chess-3d.logic');
        const engine = new ChessEngineClass(state.fen);
        const legalMoves = engine.getLegalMoves();

        if (legalMoves.length === 0) return; // No moves = game should end via checkGameOver

        // Pick a random legal move
        const randomMove = legalMoves[Math.floor(Math.random() * legalMoves.length)];

        this.logger.log(`Auto-move for ${turnUid}: ${JSON.stringify(randomMove.from)} → ${JSON.stringify(randomMove.to)}`);

        // Notify clients that this was a timeout auto-move
        this.server.to(roomName).emit('game:turn-timeout', { uid: turnUid, action: 'auto-move' });

        // Apply the move through the normal flow
        const { state: newState, version, gameResult } = this.stateManager.applyMove(
          sessionId, turnUid, 'chess-move',
          { from: randomMove.from, to: randomMove.to, promotion: randomMove.promotion || undefined },
        );

        const nextTurnUid = gameResult ? null : this.stateManager.getNextTurn(sessionId);
        const statePayload: WsGameStatePayload = { state: newState, version, turnUid: nextTurnUid };
        this.server.to(roomName).emit('game:state', statePayload);

        if (gameResult) {
          this.clearTurnTimer(sessionId);
          await this.handleGameFinished(sessionId, gameResult);
        } else if (nextTurnUid) {
          // Start timer for the next player
          this.startTurnTimer(sessionId, nextTurnUid, timeoutSec);
        }
      } catch (error) {
        this.logger.error(`Auto-move failed: ${(error as Error).message}`);
        // Fallback: just notify, don't crash
        this.server.to(roomName).emit('game:turn-timeout', { uid: turnUid, action: 'failed' });
      }
    }, timeoutSec * 1000));
  }

  private clearTurnTimer(sessionId: string): void {
    const timer = this.turnTimers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      this.turnTimers.delete(sessionId);
    }
  }

  // ─── Reliable delivery ─────────────────────────────────────────

  /**
   * Emit an event to a specific player's socket with ack. If no ack within
   * timeout, retry up to maxRetries times. Handles the case where a player's
   * socket is technically connected but recovering from a background suspension
   * (common on Android/iOS) and may silently drop the first delivery.
   */
  private emitWithAck(
    sessionId: string,
    targetUid: string,
    event: string,
    data: unknown,
    maxRetries = 2,
    timeoutMs = 3000,
  ): void {
    const socketIds = this.roomManager.getSocketIdsForUid(sessionId, targetUid);
    if (socketIds.length === 0) return;

    let attempt = 0;
    const tryEmit = () => {
      // Re-fetch socket IDs in case the player reconnected with a new socket
      const currentIds = this.roomManager.getSocketIdsForUid(sessionId, targetUid);
      if (currentIds.length === 0) return;

      for (const socketId of currentIds) {
        // With namespaced gateways, this.server is the Namespace — .sockets is Map<string, Socket>
        const socket = this.server.sockets.get(socketId);
        if (!socket) continue;

        socket.timeout(timeoutMs).emit(event, data, (err: Error | null) => {
          if (err && attempt < maxRetries) {
            attempt++;
            this.logger.debug(`No ack for ${event} to uid=${targetUid}, retry ${attempt}/${maxRetries}`);
            setTimeout(tryEmit, 1000);
          } else if (err) {
            this.logger.warn(`${event} delivery to uid=${targetUid} failed after ${maxRetries} retries`);
          }
        });
        return; // Only need to emit to one socket per player
      }
    };

    tryEmit();
  }

  // ─── Activity tracking ──────────────────────────────────────────

  /**
   * Throttled update of session lastActivityAt and player lastHeartbeat.
   * Writes to Firestore at most once per ACTIVITY_WRITE_INTERVAL_MS per session.
   */
  private _updateSessionActivity(sessionId: string, uid: string): void {
    const now = Date.now();
    const lastWrite = this.lastActivityWrite.get(sessionId) || 0;

    if (now - lastWrite < this.ACTIVITY_WRITE_INTERVAL_MS) return; // Throttled

    this.lastActivityWrite.set(sessionId, now);
    const updateTime = new Date();

    this.firebase.doc(`sessions/${sessionId}`).update({
      lastActivityAt: updateTime,
      [`players.${uid}.lastHeartbeat`]: updateTime,
    }).catch(err =>
      this.logger.warn(`Activity update failed for ${sessionId}: ${err.message}`),
    );
  }

  /**
   * Periodic heartbeat: update lastHeartbeat for all connected players across all sessions.
   * Prevents the cleanup cron from abandoning active games.
   */
  private async _heartbeatAll(): Promise<void> {
    const roomCount = this.roomManager.getRoomCount();
    if (roomCount === 0) return;

    const now = new Date();

    // Get all active sessions from the state manager
    for (const sessionId of this._getActiveSessionIds()) {
      const connectedPlayers = this.roomManager.getConnectedPlayers(sessionId);
      if (connectedPlayers.length === 0) continue;

      const updates: Record<string, unknown> = { lastActivityAt: now };
      for (const uid of connectedPlayers) {
        updates[`players.${uid}.lastHeartbeat`] = now;
      }

      this.firebase.doc(`sessions/${sessionId}`).update(updates).catch(err =>
        this.logger.warn(`Heartbeat failed for ${sessionId}: ${err.message}`),
      );
    }
  }

  /** Get all session IDs that have connected players */
  private _getActiveSessionIds(): string[] {
    return this.roomManager.getSessionIds();
  }

  private async handleGameFinished(
    sessionId: string,
    gameResult: { players: Record<string, { score: number; rank: number; outcome: 'win' | 'loss' | 'draw' }>; reason: string },
  ): Promise<void> {
    const roomName = `session:${sessionId}`;

    // Broadcast game finished
    this.server.to(roomName).emit('game:finished', { results: gameResult.players });

    // Update session status in Firestore
    await this.firebase.doc(`sessions/${sessionId}`).update({
      status: 'finished',
      finishedAt: new Date(),
      results: gameResult.players,
      lastActivityAt: new Date(),
    });

    // Call API internal endpoint to process results (scoring, ELO, etc.)
    const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:8080/api';
    const session = this.stateManager.getSession(sessionId);
    try {
      await fetch(`${apiBaseUrl}/internal/game-results`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Key': process.env.INTERNAL_API_KEY || '',
        },
        body: JSON.stringify({
          sessionId,
          gameId: session?.gameId,
          results: gameResult.players,
          reason: gameResult.reason,
        }),
      });
    } catch (error) {
      this.logger.error(`Failed to notify API of game results: ${(error as Error).message}`);
    }

    // Evict session from memory after a short delay
    setTimeout(() => {
      this.stateManager.evictSession(sessionId).catch(() => {});
      this.lastActivityWrite.delete(sessionId);
    }, 10_000);

    this.logger.log(`Game finished: session=${sessionId} reason=${gameResult.reason}`);
  }
}
