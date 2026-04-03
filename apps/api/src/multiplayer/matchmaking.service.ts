import {
  Injectable,
  Logger,
  ConflictException,
} from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { MatchmakingEntry } from '@weekly-arcade/shared';
import { MultiplayerService } from './multiplayer.service';
import { MULTIPLAYER_DEFAULTS } from './config/multiplayer-defaults';
import * as crypto from 'crypto';

@Injectable()
export class MatchmakingService {
  private readonly logger = new Logger(MatchmakingService.name);

  constructor(
    private readonly firebase: FirebaseService,
    private readonly multiplayerService: MultiplayerService,
  ) {}

  /**
   * Add a player to the matchmaking queue.
   */
  async findMatch(uid: string, displayName: string, avatarUrl: string | null, gameId: string): Promise<{ queueEntryId: string; matchedSessionId?: string }> {
    // Check if already in queue — but expire stale entries first
    const existing = await this.firebase
      .collection('matchmakingQueue')
      .where('uid', '==', uid)
      .where('status', '==', 'waiting')
      .limit(5)
      .get();

    const now = Date.now();
    const maxAgeMs = MULTIPLAYER_DEFAULTS.MATCHMAKING_EXPIRE_SEC * 1000;
    let hasActiveEntry = false;

    for (const doc of existing.docs) {
      const data = doc.data() as MatchmakingEntry;
      const joinedAt = data.joinedAt instanceof Date
        ? data.joinedAt.getTime()
        : (data.joinedAt as any)?._seconds
          ? (data.joinedAt as any)._seconds * 1000
          : new Date(data.joinedAt as any).getTime();

      if (now - joinedAt > maxAgeMs) {
        // Stale — expire it
        doc.ref.update({ status: 'expired' }).catch(() => {});
      } else {
        hasActiveEntry = true;
      }
    }

    if (hasActiveEntry) {
      throw new ConflictException('Already in matchmaking queue');
    }

    // Get player's rating
    const userDoc = await this.firebase.doc(`users/${uid}`).get();
    const rating = userDoc.data()?.multiplayerRating ?? MULTIPLAYER_DEFAULTS.DEFAULT_RATING;

    const entryId = crypto.randomUUID();
    const entry: MatchmakingEntry = {
      uid,
      gameId,
      skillRating: rating,
      ratingWindowMin: rating - MULTIPLAYER_DEFAULTS.INITIAL_RATING_WINDOW,
      ratingWindowMax: rating + MULTIPLAYER_DEFAULTS.INITIAL_RATING_WINDOW,
      status: 'waiting',
      matchedSessionId: null,
      joinedAt: new Date(),
    };

    await this.firebase.doc(`matchmakingQueue/${entryId}`).set(entry);

    // Try immediate match
    const matchResult = await this.tryMatchPlayer(entryId, uid, gameId, rating, displayName, avatarUrl);

    return {
      queueEntryId: entryId,
      matchedSessionId: matchResult ?? undefined,
    };
  }

  /**
   * Cancel matchmaking.
   */
  async cancelMatchmaking(uid: string): Promise<void> {
    const snapshot = await this.firebase
      .collection('matchmakingQueue')
      .where('uid', '==', uid)
      .where('status', '==', 'waiting')
      .limit(1)
      .get();

    if (!snapshot.empty) {
      await snapshot.docs[0].ref.update({ status: 'expired' });
    }
  }

  /**
   * Get matchmaking status for a player.
   */
  async getStatus(uid: string): Promise<{ status: string; sessionId?: string } | null> {
    const snapshot = await this.firebase
      .collection('matchmakingQueue')
      .where('uid', '==', uid)
      .orderBy('joinedAt', 'desc')
      .limit(1)
      .get();

    if (snapshot.empty) return null;

    const entry = snapshot.docs[0].data() as MatchmakingEntry;
    return {
      status: entry.status,
      sessionId: entry.matchedSessionId ?? undefined,
    };
  }

  /**
   * Try to find a match for a player. Called on queue entry and by the scan cron.
   */
  async tryMatchPlayer(
    entryId: string,
    uid: string,
    gameId: string,
    rating: number,
    displayName?: string,
    avatarUrl?: string | null,
  ): Promise<string | null> {
    // Find compatible opponents
    const candidates = await this.firebase
      .collection('matchmakingQueue')
      .where('gameId', '==', gameId)
      .where('status', '==', 'waiting')
      .where('ratingWindowMin', '<=', rating)
      .limit(10)
      .get();

    // Filter: not self, rating window includes us, not stale
    const now = Date.now();
    const maxAgeMs = MULTIPLAYER_DEFAULTS.MATCHMAKING_EXPIRE_SEC * 1000;
    const staleRefs: FirebaseFirestore.DocumentReference[] = [];

    const match = candidates.docs
      .filter(doc => {
        const data = doc.data() as MatchmakingEntry;

        // Skip self
        if (data.uid === uid) return false;

        // Skip stale entries (older than expire timeout)
        const joinedAt = data.joinedAt instanceof Date
          ? data.joinedAt.getTime()
          : (data.joinedAt as any)?._seconds
            ? (data.joinedAt as any)._seconds * 1000
            : new Date(data.joinedAt as any).getTime();
        if (now - joinedAt > maxAgeMs) {
          staleRefs.push(doc.ref);
          return false;
        }

        // Rating window check
        return data.ratingWindowMax >= rating;
      })
      .sort((a, b) => {
        const aData = a.data() as MatchmakingEntry;
        const bData = b.data() as MatchmakingEntry;
        return Math.abs(aData.skillRating - rating) - Math.abs(bData.skillRating - rating);
      })[0];

    // Clean up stale entries in background
    if (staleRefs.length > 0) {
      const batch = this.firebase.batch();
      for (const ref of staleRefs) {
        batch.update(ref, { status: 'expired' });
      }
      batch.commit().catch(err => this.logger.warn('Stale queue cleanup failed:', err.message));
      this.logger.log(`Cleaned ${staleRefs.length} stale matchmaking entries`);
    }

    if (!match) return null;

    const matchData = match.data() as MatchmakingEntry;

    // Atomically claim the match — prevent race conditions where two players
    // both try to match with the same queue entry simultaneously
    try {
      await this.firebase.runTransaction(async (txn) => {
        const freshDoc = await txn.get(match.ref);
        if (!freshDoc.exists || freshDoc.data()?.status !== 'waiting') {
          throw new Error('Match entry already claimed');
        }
        // Mark as matched inside the transaction to prevent double-matching
        txn.update(match.ref, { status: 'matched' });
      });
    } catch (e) {
      this.logger.warn(`Match race condition: ${matchData.uid} already claimed`);
      return null; // Someone else matched with them first
    }

    // Resolve display name if not provided (e.g., called from cron)
    if (!displayName) {
      const userDoc = await this.firebase.doc(`users/${uid}`).get();
      displayName = userDoc.data()?.displayName || 'Player';
      avatarUrl = userDoc.data()?.avatarUrl || null;
    }

    // Create session with the searching player (uid) as host
    const session = await this.multiplayerService.createSession(uid, displayName!, avatarUrl ?? null, {
      gameId,
      mode: 'quick-match',
      maxPlayers: 2,
      minPlayers: 2,
    });

    // Auto-join the matched opponent into the session
    let matchDisplayName = 'Player';
    let matchAvatarUrl: string | null = null;
    try {
      const matchUserDoc = await this.firebase.doc(`users/${matchData.uid}`).get();
      matchDisplayName = matchUserDoc.data()?.displayName || 'Player';
      matchAvatarUrl = matchUserDoc.data()?.avatarUrl || null;
    } catch (e) { /* fallback to defaults */ }

    await this.multiplayerService.joinSession(session.sessionId, matchData.uid, matchDisplayName, matchAvatarUrl);

    // Auto-start for quick match (both players are already in)
    try {
      await this.multiplayerService.startGame(session.sessionId, uid);
    } catch (e) {
      // startGame may fail if minPlayers not met yet — that's OK
    }

    // Update both queue entries with the session ID
    const batch = this.firebase.batch();
    batch.update(this.firebase.doc(`matchmakingQueue/${entryId}`), {
      status: 'matched',
      matchedSessionId: session.sessionId,
    });
    // Opponent was marked 'matched' in the transaction — now add the sessionId
    batch.update(match.ref, {
      matchedSessionId: session.sessionId,
    });
    await batch.commit();

    this.logger.log(`Match found: ${uid} vs ${matchData.uid} → session ${session.sessionId}`);
    return session.sessionId;
  }

  // ─── ELO Rating ───────────────────────────────────────────────────

  /**
   * Calculate new ELO ratings after a match.
   */
  calculateElo(
    winnerRating: number,
    loserRating: number,
  ): { winnerNew: number; loserNew: number } {
    const K = MULTIPLAYER_DEFAULTS.ELO_K_FACTOR;

    const expectedWinner = 1 / (1 + Math.pow(10, (loserRating - winnerRating) / 400));
    const expectedLoser = 1 / (1 + Math.pow(10, (winnerRating - loserRating) / 400));

    const winnerNew = Math.max(MULTIPLAYER_DEFAULTS.RATING_FLOOR, Math.round(winnerRating + K * (1 - expectedWinner)));
    const loserNew = Math.max(MULTIPLAYER_DEFAULTS.RATING_FLOOR, Math.round(loserRating + K * (0 - expectedLoser)));

    return { winnerNew, loserNew };
  }
}
