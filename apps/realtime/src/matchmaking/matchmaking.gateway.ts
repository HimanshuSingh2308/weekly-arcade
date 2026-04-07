import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { Server, Socket } from 'socket.io';
import { FirebaseService } from '../firebase/firebase.service';
import { AuthenticatedSocket, createWsAuthMiddleware } from '../auth/ws-auth.middleware';
import * as crypto from 'crypto';

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

interface QueuedPlayer {
  uid: string;
  gameId: string;
  socketId: string;
  socket: Socket;
  joinedAt: number;
}

/**
 * WebSocket gateway for real-time matchmaking notifications.
 * Players connect to this namespace while searching for a match.
 * When the API/cron creates a match, it writes to Firestore — this gateway
 * detects the match and pushes the session ID instantly to both players.
 *
 * Also supports direct in-memory matching for two players searching simultaneously.
 */
@WebSocketGateway({
  namespace: '/matchmaking',
  cors: { origin: ALLOWED_ORIGINS, credentials: true },
  pingInterval: 10000,
  pingTimeout: 30000,
})
export class MatchmakingGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(MatchmakingGateway.name);

  @WebSocketServer()
  server: Server;

  // In-memory: uid → socket for instant push when a match is found via REST/cron
  private readonly waitingSockets = new Map<string, QueuedPlayer>();

  constructor(private readonly firebase: FirebaseService) {}

  afterInit(server: Server) {
    server.use(createWsAuthMiddleware(this.firebase));
    this.logger.log('Matchmaking gateway initialized');
  }

  handleConnection(client: AuthenticatedSocket) {
    if (!client.data?.user) return;
    this.logger.debug(`Matchmaking WS connected: ${client.data.user.uid}`);
  }

  handleDisconnect(client: AuthenticatedSocket) {
    if (!client.data?.user) return;
    const uid = client.data.user.uid;
    this.waitingSockets.delete(uid);
    this.logger.debug(`Matchmaking WS disconnected: ${uid}`);
  }

  /**
   * Client signals it's searching for a match.
   * The REST `findMatch` already created the Firestore queue entry —
   * this just registers the socket for instant push notification.
   */
  @SubscribeMessage('matchmaking:search')
  handleSearch(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { gameId: string },
  ) {
    const uid = client.data.user.uid;
    const gameId = data?.gameId;
    if (!gameId) return;

    this.waitingSockets.set(uid, {
      uid,
      gameId,
      socketId: client.id,
      socket: client,
      joinedAt: Date.now(),
    });

    // Join a room for this game so we can broadcast game-specific events
    client.join(`matchmaking:${gameId}`);
    this.logger.log(`Player ${uid} searching for ${gameId} match`);

    // Broadcast updated queue count to all searchers for this game
    this._broadcastQueueCount(gameId);
  }

  /**
   * Client cancels their search.
   */
  @SubscribeMessage('matchmaking:cancel')
  handleCancel(@ConnectedSocket() client: AuthenticatedSocket) {
    const uid = client.data.user.uid;
    const entry = this.waitingSockets.get(uid);
    if (entry) {
      client.leave(`matchmaking:${entry.gameId}`);
      this.waitingSockets.delete(uid);
      this._broadcastQueueCount(entry.gameId);
    }
  }

  /**
   * Called by the API (or cron) when a match is found.
   * Pushes the session ID to both players instantly if they have sockets.
   */
  notifyMatch(uid1: string, uid2: string, sessionId: string): void {
    for (const uid of [uid1, uid2]) {
      const entry = this.waitingSockets.get(uid);
      if (entry) {
        entry.socket.emit('matchmaking:matched', { sessionId });
        entry.socket.leave(`matchmaking:${entry.gameId}`);
        this.waitingSockets.delete(uid);
        this.logger.log(`Pushed match to ${uid}: session ${sessionId}`);
      }
    }
  }

  /** Get UIDs of all players currently waiting for a game */
  getWaitingPlayers(gameId: string): string[] {
    const uids: string[] = [];
    for (const [uid, entry] of this.waitingSockets) {
      if (entry.gameId === gameId) uids.push(uid);
    }
    return uids;
  }

  private _broadcastQueueCount(gameId: string) {
    const count = this.getWaitingPlayers(gameId).length;
    this.server.to(`matchmaking:${gameId}`).emit('matchmaking:queue-count', { count });
  }

  // ─── Matchmaking scan (direct Firestore, every 5s) ───────────────

  private static readonly MATCHMAKING_EXPIRE_SEC = 120;
  private static readonly INITIAL_RATING_WINDOW = 200;
  private static readonly RATING_WINDOW_STEP = 200;
  private static readonly RATING_WINDOW_MAX = 9999;
  private static readonly RATING_FLOOR = 100;
  private static readonly WIDEN_INTERVAL_SEC = 10;

  /**
   * Scan matchmaking queue: widen windows, expire stale entries, match pairs.
   * Runs directly against Firestore — no API call needed.
   * Only fires when players are actively searching.
   */
  @Interval(5000)
  async scanMatchmaking() {
    // Always scan Firestore — don't gate on waitingSockets.
    // WS connections may not exist (Cloud Run restart, client didn't connect to /matchmaking).
    // Firestore entries are the source of truth.

    try {
      const snapshot = await this.firebase
        .collection('matchmakingQueue')
        .where('status', '==', 'waiting')
        .limit(100)
        .get();

      if (snapshot.empty) {
        this.logger.debug('Matchmaking scan: no waiting entries in queue');
        return;
      }

      this.logger.log(`Matchmaking scan: ${snapshot.size} waiting entries found`);
      const now = Date.now();
      const batch = this.firebase.batch();
      let updates = 0;

      for (const doc of snapshot.docs) {
        const entry = doc.data();
        const joinedAt = entry.joinedAt instanceof Date
          ? entry.joinedAt.getTime()
          : entry.joinedAt?._seconds
            ? entry.joinedAt._seconds * 1000
            : new Date(entry.joinedAt).getTime();
        const waitSec = (now - joinedAt) / 1000;

        // Expire stale entries
        if (waitSec >= MatchmakingGateway.MATCHMAKING_EXPIRE_SEC) {
          batch.update(doc.ref, { status: 'expired' });
          updates++;
          continue;
        }

        // Widen rating window
        const widenSteps = Math.floor(waitSec / MatchmakingGateway.WIDEN_INTERVAL_SEC);
        const newMin = Math.max(
          MatchmakingGateway.RATING_FLOOR,
          entry.skillRating - MatchmakingGateway.INITIAL_RATING_WINDOW - (widenSteps * MatchmakingGateway.RATING_WINDOW_STEP),
        );
        const newMax = Math.min(
          entry.skillRating + MatchmakingGateway.RATING_WINDOW_MAX,
          entry.skillRating + MatchmakingGateway.INITIAL_RATING_WINDOW + (widenSteps * MatchmakingGateway.RATING_WINDOW_STEP),
        );

        if (newMin !== entry.ratingWindowMin || newMax !== entry.ratingWindowMax) {
          batch.update(doc.ref, { ratingWindowMin: newMin, ratingWindowMax: newMax });
          updates++;
        }
      }

      if (updates > 0) await batch.commit();

      // Re-query for fresh data after widening
      const freshDocs = updates > 0
        ? (await this.firebase.collection('matchmakingQueue').where('status', '==', 'waiting').limit(100).get()).docs
        : snapshot.docs;

      // Try to match pairs
      const matchedUids = new Set<string>();
      const entries = freshDocs.map(d => ({ id: d.id, ref: d.ref, ...d.data() }));

      for (const entry of entries) {
        if (matchedUids.has(entry.uid)) continue;

        // Find a compatible opponent
        const opponent = entries.find(other => {
          if (other.uid === entry.uid || matchedUids.has(other.uid)) return false;
          if (other.gameId !== entry.gameId) return false;
          // Mutual window check
          if (other.ratingWindowMin > entry.skillRating || other.ratingWindowMax < entry.skillRating) return false;
          if (entry.ratingWindowMin > other.skillRating || entry.ratingWindowMax < other.skillRating) return false;
          return true;
        });

        if (!opponent) continue;

        // Atomically claim both entries with 'claiming' — prevents double-matching
        // Only transitions to 'matched' after session creation succeeds
        try {
          await this.firebase.runTransaction(async (txn) => {
            const freshA = await txn.get(entry.ref);
            const freshB = await txn.get(opponent.ref);
            if (!freshA.exists || freshA.data()?.status !== 'waiting') throw new Error('A claimed');
            if (!freshB.exists || freshB.data()?.status !== 'waiting') throw new Error('B claimed');
            txn.update(entry.ref, { status: 'claiming' });
            txn.update(opponent.ref, { status: 'claiming' });
          });
        } catch {
          continue; // Race condition — someone else matched them
        }

        // Create session — if this fails, release both entries back to 'waiting'
        let sessionId: string;
        try {
          sessionId = crypto.randomUUID();
          const sessionNow = new Date();
          await this.firebase.doc(`sessions/${sessionId}`).set({
            sessionId,
            gameId: entry.gameId,
            hostUid: entry.uid,
            status: 'starting',
            mode: 'quick-match',
            joinCode: null,
            players: {
              [entry.uid]: { displayName: 'Player', avatarUrl: null, joinedAt: sessionNow, status: 'connected', lastHeartbeat: sessionNow, isHost: true },
              [opponent.uid]: { displayName: 'Player', avatarUrl: null, joinedAt: sessionNow, status: 'connected', lastHeartbeat: sessionNow, isHost: false },
            },
            playerCount: 2,
            maxPlayers: 2,
            minPlayers: 2,
            currentTurnUid: null,
            turnNumber: 0,
            turnDeadline: null,
            gameConfig: {},
            createdAt: sessionNow,
            startedAt: sessionNow,
            finishedAt: null,
            lastActivityAt: sessionNow,
            results: null,
            spectatorCount: 0,
            spectatorAllowed: false,
            flags: { ipConflict: false, suspiciousPlayers: [], reviewRequired: false },
          });
        } catch (e) {
          // Session creation failed — release both back to 'waiting'
          this.logger.error(`Session creation failed: ${(e as Error).message}`);
          const rollback = this.firebase.batch();
          rollback.update(entry.ref, { status: 'waiting' });
          rollback.update(opponent.ref, { status: 'waiting' });
          await rollback.commit().catch(() => {});
          continue;
        }

        // Success — mark both as 'matched' with sessionId in one atomic batch
        const updateBatch = this.firebase.batch();
        updateBatch.update(entry.ref, { status: 'matched', matchedSessionId: sessionId });
        updateBatch.update(opponent.ref, { status: 'matched', matchedSessionId: sessionId });
        await updateBatch.commit();

        matchedUids.add(entry.uid);
        matchedUids.add(opponent.uid);

        // Push instant notification to connected players
        this.notifyMatch(entry.uid, opponent.uid, sessionId);

        this.logger.log(`Matched ${entry.uid} vs ${opponent.uid} → session ${sessionId}`);
      }
    } catch (error) {
      this.logger.error(`Matchmaking scan failed: ${(error as Error).message}`);
    }
  }
}
