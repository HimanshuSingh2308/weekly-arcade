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
    // Check if already in queue
    const existing = await this.firebase
      .collection('matchmakingQueue')
      .where('uid', '==', uid)
      .where('status', '==', 'waiting')
      .limit(1)
      .get();

    if (!existing.empty) {
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

    // Filter: not self, rating window includes us
    const match = candidates.docs
      .filter(doc => {
        const data = doc.data() as MatchmakingEntry;
        return data.uid !== uid && data.ratingWindowMax >= rating;
      })
      .sort((a, b) => {
        const aData = a.data() as MatchmakingEntry;
        const bData = b.data() as MatchmakingEntry;
        return Math.abs(aData.skillRating - rating) - Math.abs(bData.skillRating - rating);
      })[0];

    if (!match) return null;

    const matchData = match.data() as MatchmakingEntry;

    // Resolve display name if not provided (e.g., called from cron)
    if (!displayName) {
      const userDoc = await this.firebase.doc(`users/${uid}`).get();
      displayName = userDoc.data()?.displayName || 'Player';
      avatarUrl = userDoc.data()?.avatarUrl || null;
    }

    // Create session
    const session = await this.multiplayerService.createSession(uid, displayName!, avatarUrl ?? null, {
      gameId,
      mode: 'quick-match',
      maxPlayers: 2,
      minPlayers: 2,
    });

    // Update both queue entries
    const batch = this.firebase.batch();
    batch.update(this.firebase.doc(`matchmakingQueue/${entryId}`), {
      status: 'matched',
      matchedSessionId: session.sessionId,
    });
    batch.update(match.ref, {
      status: 'matched',
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
