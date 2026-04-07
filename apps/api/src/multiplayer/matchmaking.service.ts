import {
  Injectable,
  Logger,
} from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { MatchmakingEntry } from '@weekly-arcade/shared';
import { MultiplayerService } from './multiplayer.service';
import { MULTIPLAYER_DEFAULTS } from './config/multiplayer-defaults';
import * as crypto from 'crypto';
import * as admin from 'firebase-admin';

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
    // Force-expire any existing entries for this user (stale or active)
    // This prevents the race where a client re-queues while an old entry lingers
    const existing = await this.firebase
      .collection('matchmakingQueue')
      .where('uid', '==', uid)
      .where('status', '==', 'waiting')
      .limit(5)
      .get();

    if (!existing.empty) {
      const batch = this.firebase.batch();
      for (const doc of existing.docs) {
        batch.update(doc.ref, { status: 'expired' });
      }
      await batch.commit();
      this.logger.debug(`Expired ${existing.size} stale queue entries for ${uid}`);
    }

    // Get player's per-game rating (falls back to global, then default)
    const rating = await this.getPlayerRating(uid, gameId);

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
    // Only return waiting or recently matched entries — ignore old expired/matched entries
    const snapshot = await this.firebase
      .collection('matchmakingQueue')
      .where('uid', '==', uid)
      .orderBy('joinedAt', 'desc')
      .limit(5)
      .get();

    if (snapshot.empty) return null;

    // Find the most recent relevant entry (waiting or matched with a valid session)
    for (const doc of snapshot.docs) {
      const entry = doc.data() as MatchmakingEntry;

      if (entry.status === 'waiting') {
        return { status: 'waiting' };
      }

      if (entry.status === 'matched' && entry.matchedSessionId) {
        // Verify the matched session is still active (not abandoned/finished)
        try {
          const sessionDoc = await this.firebase.doc(`sessions/${entry.matchedSessionId}`).get();
          if (sessionDoc.exists) {
            const session = sessionDoc.data();
            if (session?.status === 'waiting' || session?.status === 'starting' || session?.status === 'playing') {
              return { status: 'matched', sessionId: entry.matchedSessionId };
            }
          }
        } catch {
          // Session not found — treat as expired
        }
        // Session is stale — expire this entry and keep looking
        doc.ref.update({ status: 'expired' }).catch(() => {});
        continue;
      }

      // Expired entry — return expired so client can re-queue
      if (entry.status === 'expired') {
        return { status: 'expired' };
      }
    }

    return null;
  }

  /**
   * Try to find a match for a player. Called on queue entry and by the scan cron.
   * Checks mutual compatibility: both players' windows must include each other's rating.
   */
  async tryMatchPlayer(
    entryId: string,
    uid: string,
    gameId: string,
    rating: number,
    displayName?: string,
    avatarUrl?: string | null,
    callerWindowMin?: number,
    callerWindowMax?: number,
  ): Promise<string | null> {
    // Use caller's widened window if provided, otherwise derive from rating
    const myWindowMin = callerWindowMin ?? (rating - MULTIPLAYER_DEFAULTS.INITIAL_RATING_WINDOW);
    const myWindowMax = callerWindowMax ?? (rating + MULTIPLAYER_DEFAULTS.INITIAL_RATING_WINDOW);

    // Find candidates whose window includes our rating
    const candidates = await this.firebase
      .collection('matchmakingQueue')
      .where('gameId', '==', gameId)
      .where('status', '==', 'waiting')
      .where('ratingWindowMin', '<=', rating)
      .limit(10)
      .get();

    // Filter: not self, mutual window overlap, not stale
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

        // Mutual window check:
        // 1. Candidate's window includes our rating (query already ensures min <= rating)
        if (data.ratingWindowMax < rating) return false;
        // 2. Our window includes candidate's rating
        if (data.skillRating < myWindowMin || data.skillRating > myWindowMax) return false;

        return true;
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

    // Push instant notification to realtime server (fire-and-forget)
    this._notifyRealtimeMatch(uid, matchData.uid, session.sessionId);

    return session.sessionId;
  }

  /**
   * Notify the realtime server of a match so it can push to WebSocket clients instantly.
   */
  private _notifyRealtimeMatch(uid1: string, uid2: string, sessionId: string): void {
    const realtimeUrl = process.env.REALTIME_SERVICE_URL || 'http://localhost:3001';
    const internalKey = process.env.INTERNAL_API_KEY;
    if (!internalKey) return;

    fetch(`${realtimeUrl}/internal/matchmaking/notify-match`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-key': internalKey,
      },
      body: JSON.stringify({ uid1, uid2, sessionId }),
    }).catch(err => this.logger.warn(`Realtime match notify failed: ${err.message}`));
  }

  // ─── Rating System ───────────────────────────────────────────────

  /**
   * Get a player's rating for a specific game.
   * Reads from per-game mpRatings subcollection, falls back to global, then default.
   */
  async getPlayerRating(uid: string, gameId: string): Promise<number> {
    // 1. Per-game rating (most accurate)
    const gameRatingDoc = await this.firebase.doc(`users/${uid}/mpRatings/${gameId}`).get();
    if (gameRatingDoc.exists) {
      return gameRatingDoc.data()?.rating ?? MULTIPLAYER_DEFAULTS.DEFAULT_RATING;
    }

    // 2. Global multiplayer rating (legacy or cross-game baseline)
    const userDoc = await this.firebase.doc(`users/${uid}`).get();
    if (userDoc.exists && userDoc.data()?.multiplayerRating != null) {
      return userDoc.data()!.multiplayerRating;
    }

    // 3. Default
    return MULTIPLAYER_DEFAULTS.DEFAULT_RATING;
  }

  /**
   * Update a player's per-game rating and stats after a match.
   * Also recalculates the global rating as a weighted average across all games.
   */
  async updatePlayerRating(
    uid: string,
    gameId: string,
    newRating: number,
    outcome: 'win' | 'loss' | 'draw',
  ): Promise<void> {
    const gameRatingRef = this.firebase.doc(`users/${uid}/mpRatings/${gameId}`);
    const gameRatingDoc = await gameRatingRef.get();

    if (gameRatingDoc.exists) {
      const statsField = outcome === 'win' ? 'won' : outcome === 'loss' ? 'lost' : 'drawn';
      await gameRatingRef.update({
        rating: newRating,
        played: admin.firestore.FieldValue.increment(1),
        [statsField]: admin.firestore.FieldValue.increment(1),
        updatedAt: new Date(),
      });
    } else {
      await gameRatingRef.set({
        gameId,
        rating: newRating,
        played: 1,
        won: outcome === 'win' ? 1 : 0,
        lost: outcome === 'loss' ? 1 : 0,
        drawn: outcome === 'draw' ? 1 : 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // Recalculate global rating as weighted average across all games
    await this._updateGlobalRating(uid);
  }

  /**
   * Recalculate the global multiplayer rating as a weighted average
   * of all per-game ratings (weighted by games played).
   */
  private async _updateGlobalRating(uid: string): Promise<void> {
    const snapshot = await this.firebase
      .collection(`users/${uid}/mpRatings`)
      .get();

    if (snapshot.empty) return;

    let totalWeight = 0;
    let weightedSum = 0;
    let totalPlayed = 0;
    let totalWon = 0;
    let totalLost = 0;
    let totalDrawn = 0;

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const played = data.played || 0;
      const rating = data.rating || MULTIPLAYER_DEFAULTS.DEFAULT_RATING;

      // Weight by games played — more games = more influence on global rating
      totalWeight += played;
      weightedSum += rating * played;
      totalPlayed += played;
      totalWon += data.won || 0;
      totalLost += data.lost || 0;
      totalDrawn += data.drawn || 0;
    }

    const globalRating = totalWeight > 0
      ? Math.round(weightedSum / totalWeight)
      : MULTIPLAYER_DEFAULTS.DEFAULT_RATING;

    await this.firebase.doc(`users/${uid}`).update({
      multiplayerRating: globalRating,
      'multiplayerStats.played': totalPlayed,
      'multiplayerStats.won': totalWon,
      'multiplayerStats.lost': totalLost,
      'multiplayerStats.drawn': totalDrawn,
    });
  }

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
