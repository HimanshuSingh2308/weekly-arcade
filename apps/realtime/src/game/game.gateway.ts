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
import { Session, WsGameStatePayload, WsMovePayload } from '@weekly-arcade/shared';

const ALLOWED_ORIGINS = [
  'http://localhost:4200',
  'http://localhost:4201',
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

        // Broadcast to room that player joined/reconnected
        const wasDisconnected = player?.status === 'disconnected';
        client.to(roomName).emit(
          wasDisconnected ? 'session:player-reconnected' : 'session:player-joined',
          { uid, displayName: player?.displayName || '', avatarUrl: player?.avatarUrl || null },
        );
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
      this.logger.error(`Connection error: ${(error as Error).message}`);
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

      const turnUid = gameResult ? null : this.stateManager.getNextTurn(sessionId);

      // Broadcast new state to all clients in the room
      const roomName = `session:${sessionId}`;
      const statePayload: WsGameStatePayload = { state, version, turnUid };
      this.server.to(roomName).emit('game:state', statePayload);

      // If game is over, handle finish
      if (gameResult) {
        await this.handleGameFinished(sessionId, gameResult);
      }
    } catch (error) {
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

  /**
   * Check if all connected players are ready and the session is in starting/playing state.
   * If so, initialize the game state and broadcast to all clients.
   */
  private async tryStartGame(sessionId: string, roomName: string): Promise<void> {
    const activeSession = this.stateManager.getSession(sessionId);
    if (!activeSession || activeSession.version > 0) return; // Already initialized

    // Read session from Firestore to check status
    const sessionDoc = await this.firebase.doc(`sessions/${sessionId}`).get();
    if (!sessionDoc.exists) return;
    const session = sessionDoc.data() as Session;

    // Need at least minPlayers connected
    const connectedPlayers = this.roomManager.getConnectedPlayers(sessionId);
    if (connectedPlayers.length < session.minPlayers) return;

    // Session must be starting or playing
    if (session.status !== 'starting' && session.status !== 'playing') return;

    // All connected players must be ready
    const readyPlayers = this.roomManager.getReadyPlayers(sessionId);
    const allReady = connectedPlayers.every(uid => readyPlayers.includes(uid));
    if (!allReady) return;

    // Initialize game state
    try {
      const playerUids = Object.keys(session.players).filter(
        uid => session.players[uid].status !== 'left'
      );
      const state = await this.stateManager.initializeGame(
        sessionId, playerUids, session.gameConfig || {}
      );

      // Update Firestore to playing if still starting
      if (session.status === 'starting') {
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
    }, 10_000);

    this.logger.log(`Game finished: session=${sessionId} reason=${gameResult.reason}`);
  }
}
