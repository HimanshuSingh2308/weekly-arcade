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
import { Server, Socket } from 'socket.io';
import { FirebaseService } from '../firebase/firebase.service';
import { AuthenticatedSocket, createWsAuthMiddleware } from '../auth/ws-auth.middleware';

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
}
