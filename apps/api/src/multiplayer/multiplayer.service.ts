import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import {
  Session,
  SessionStatus,
  SessionPlayer,
  SessionFlags,
  getGameInfo,
} from '@weekly-arcade/shared';
import { CreateSessionDto } from './dto/create-session.dto';
import { MULTIPLAYER_DEFAULTS } from './config/multiplayer-defaults';
import * as crypto from 'crypto';

@Injectable()
export class MultiplayerService {
  private readonly logger = new Logger(MultiplayerService.name);

  constructor(private readonly firebase: FirebaseService) {}

  // ─── Session CRUD ─────────────────────────────────────────────────

  async createSession(uid: string, displayName: string, avatarUrl: string | null, dto: CreateSessionDto): Promise<Session> {
    // Validate game exists and supports multiplayer
    const gameInfo = getGameInfo(dto.gameId);
    if (!gameInfo) {
      throw new BadRequestException(`Unknown game: ${dto.gameId}`);
    }
    if (gameInfo.multiplayer && !gameInfo.multiplayer.enabled) {
      throw new BadRequestException(`Game ${dto.gameId} does not support multiplayer`);
    }

    // Check concurrent session limit PER GAME (not global)
    const activeSessions = await this.getActiveSessionsForUser(uid);
    const gameActiveSessions = activeSessions.filter(s => s.gameId === dto.gameId);
    if (gameActiveSessions.length >= MULTIPLAYER_DEFAULTS.MAX_CONCURRENT_SESSIONS) {
      throw new ConflictException(`Maximum ${MULTIPLAYER_DEFAULTS.MAX_CONCURRENT_SESSIONS} concurrent sessions allowed for ${dto.gameId}`);
    }

    const sessionId = crypto.randomUUID();
    const joinCode = dto.mode === 'private' ? this.generateJoinCode() : null;
    const now = new Date();
    const minPlayers = dto.minPlayers ?? 2;

    const hostPlayer: SessionPlayer = {
      displayName,
      avatarUrl,
      joinedAt: now,
      status: 'connected',
      lastHeartbeat: now,
      isHost: true,
    };

    const flags: SessionFlags = {
      ipConflict: false,
      suspiciousPlayers: [],
      reviewRequired: false,
    };

    const session: Session = {
      sessionId,
      gameId: dto.gameId,
      hostUid: uid,
      status: 'waiting',
      mode: dto.mode,
      joinCode,
      players: { [uid]: hostPlayer },
      playerCount: 1,
      maxPlayers: dto.maxPlayers,
      minPlayers,
      currentTurnUid: null,
      turnNumber: 0,
      turnDeadline: null,
      gameConfig: dto.gameConfig ?? {},
      createdAt: now,
      startedAt: null,
      finishedAt: null,
      lastActivityAt: now,
      results: null,
      spectatorCount: 0,
      spectatorAllowed: dto.spectatorAllowed ?? false,
      flags,
    };

    await this.firebase.doc(`sessions/${sessionId}`).set(session);
    this.logger.log(`Session created: ${sessionId} (game=${dto.gameId}, mode=${dto.mode})`);

    return session;
  }

  async getSession(sessionId: string): Promise<Session> {
    const doc = await this.firebase.doc(`sessions/${sessionId}`).get();
    if (!doc.exists) {
      throw new NotFoundException('Session not found');
    }
    return doc.data() as Session;
  }

  async joinSession(sessionId: string, uid: string, displayName: string, avatarUrl: string | null): Promise<Session> {
    const session = await this.getSession(sessionId);

    if (session.status !== 'waiting') {
      throw new BadRequestException('Session is not accepting players');
    }

    if (session.players[uid] && session.players[uid].status !== 'left') {
      throw new ConflictException('Already in this session');
    }

    if (session.playerCount >= session.maxPlayers) {
      throw new BadRequestException('Session is full');
    }

    const now = new Date();
    const player: SessionPlayer = {
      displayName,
      avatarUrl,
      joinedAt: now,
      status: 'connected',
      lastHeartbeat: now,
      isHost: false,
    };

    await this.firebase.doc(`sessions/${sessionId}`).update({
      [`players.${uid}`]: player,
      playerCount: session.playerCount + 1,
      lastActivityAt: now,
    });

    return { ...session, players: { ...session.players, [uid]: player }, playerCount: session.playerCount + 1 };
  }

  async joinByCode(code: string, uid: string, displayName: string, avatarUrl: string | null): Promise<Session> {
    const snapshot = await this.firebase
      .collection('sessions')
      .where('joinCode', '==', code.toUpperCase())
      .where('status', '==', 'waiting')
      .limit(1)
      .get();

    if (snapshot.empty) {
      throw new NotFoundException('Invalid or expired join code');
    }

    const sessionId = snapshot.docs[0].id;
    return this.joinSession(sessionId, uid, displayName, avatarUrl);
  }

  async leaveSession(sessionId: string, uid: string): Promise<void> {
    const session = await this.getSession(sessionId);
    const player = session.players[uid];

    if (!player || player.status === 'left') {
      throw new BadRequestException('Not in this session');
    }

    const now = new Date();
    const updates: Record<string, unknown> = {
      [`players.${uid}.status`]: 'left',
      playerCount: Math.max(0, session.playerCount - 1),
      lastActivityAt: now,
    };

    // Host migration
    if (player.isHost) {
      const nextHost = this.findNextHost(session, uid);
      if (nextHost) {
        updates[`players.${uid}.isHost`] = false;
        updates[`players.${nextHost}.isHost`] = true;
        updates['hostUid'] = nextHost;
      }
    }

    // If no players left, mark as abandoned
    const remainingPlayers = Object.entries(session.players)
      .filter(([id, p]) => id !== uid && p.status !== 'left')
      .length;

    if (remainingPlayers === 0) {
      updates['status'] = 'abandoned';
      updates['finishedAt'] = now;
    }

    await this.firebase.doc(`sessions/${sessionId}`).update(updates);
  }

  async startGame(sessionId: string, uid: string): Promise<void> {
    const session = await this.getSession(sessionId);

    if (session.hostUid !== uid) {
      throw new ForbiddenException('Only the host can start the game');
    }

    if (session.status !== 'waiting') {
      throw new BadRequestException('Session is not in waiting state');
    }

    if (session.playerCount < session.minPlayers) {
      throw new BadRequestException(`Need at least ${session.minPlayers} players to start`);
    }

    const now = new Date();
    await this.firebase.doc(`sessions/${sessionId}`).update({
      status: 'starting',
      lastActivityAt: now,
    });

    // Transition to 'playing' after 3-second countdown
    setTimeout(async () => {
      try {
        const current = await this.getSession(sessionId);
        if (current.status === 'starting') {
          await this.firebase.doc(`sessions/${sessionId}`).update({
            status: 'playing',
            startedAt: new Date(),
            lastActivityAt: new Date(),
          });
        }
      } catch {
        // Session may have been abandoned
      }
    }, 3000);
  }

  async kickPlayer(sessionId: string, hostUid: string, targetUid: string): Promise<void> {
    const session = await this.getSession(sessionId);

    if (session.hostUid !== hostUid) {
      throw new ForbiddenException('Only the host can kick players');
    }

    if (targetUid === hostUid) {
      throw new BadRequestException('Cannot kick yourself');
    }

    if (!session.players[targetUid] || session.players[targetUid].status === 'left') {
      throw new BadRequestException('Player not in session');
    }

    await this.firebase.doc(`sessions/${sessionId}`).update({
      [`players.${targetUid}.status`]: 'left',
      playerCount: Math.max(0, session.playerCount - 1),
      lastActivityAt: new Date(),
    });
  }

  async getActiveSessionsForUser(uid: string): Promise<Session[]> {
    const activeStatuses: SessionStatus[] = ['waiting', 'starting', 'playing'];
    const sessions: Session[] = [];
    const now = Date.now();
    const staleRefs: FirebaseFirestore.DocumentReference[] = [];

    // Firestore doesn't support querying nested map keys efficiently,
    // so we query by status and filter in-memory
    for (const status of activeStatuses) {
      const snapshot = await this.firebase
        .collection('sessions')
        .where('status', '==', status)
        .limit(50)
        .get();

      for (const doc of snapshot.docs) {
        const session = doc.data() as Session;

        // Lazy cleanup: expire stale waiting sessions (5 min idle)
        if (session.status === 'waiting' && session.lastActivityAt) {
          const idleMs = now - new Date(session.lastActivityAt as unknown as string).getTime();
          if (idleMs > MULTIPLAYER_DEFAULTS.LOBBY_IDLE_TIMEOUT_MS) {
            staleRefs.push(doc.ref);
            continue; // Don't include in active list
          }
        }

        // Lazy cleanup: expire stale playing sessions (30 min max)
        if (session.status === 'playing' && session.startedAt) {
          const durationMs = now - new Date(session.startedAt as unknown as string).getTime();
          if (durationMs > MULTIPLAYER_DEFAULTS.SESSION_MAX_DURATION_MIN * 60 * 1000) {
            staleRefs.push(doc.ref);
            continue;
          }
        }

        if (session.players[uid] && session.players[uid].status !== 'left') {
          sessions.push(session);
        }
      }
    }

    // Await cleanup so callers (e.g. createSession limit check) see accurate counts
    if (staleRefs.length > 0) {
      const batch = this.firebase.batch();
      for (const ref of staleRefs) {
        batch.update(ref, { status: 'abandoned', finishedAt: new Date() });
      }
      try {
        await batch.commit();
        this.logger.log(`Lazy cleanup: ${staleRefs.length} stale sessions abandoned`);
      } catch (err) {
        this.logger.warn('Stale session cleanup failed:', (err as Error).message);
      }
    }

    return sessions;
  }

  // ─── Private helpers ──────────────────────────────────────────────

  private generateJoinCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No O/0/1/I to avoid confusion
    let code = '';
    for (let i = 0; i < MULTIPLAYER_DEFAULTS.JOIN_CODE_LENGTH; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  private findNextHost(session: Session, leavingUid: string): string | null {
    const candidates = Object.entries(session.players)
      .filter(([id, p]) => id !== leavingUid && p.status !== 'left')
      .sort((a, b) => new Date(a[1].joinedAt).getTime() - new Date(b[1].joinedAt).getTime());

    return candidates.length > 0 ? candidates[0][0] : null;
  }
}
