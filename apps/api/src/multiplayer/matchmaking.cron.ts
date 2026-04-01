import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { FirebaseService } from '../firebase/firebase.service';
import { MatchmakingEntry, Session } from '@weekly-arcade/shared';
import { MatchmakingService } from './matchmaking.service';
import { MULTIPLAYER_DEFAULTS } from './config/multiplayer-defaults';

@Injectable()
export class MatchmakingCron {
  private readonly logger = new Logger(MatchmakingCron.name);

  constructor(
    private readonly firebase: FirebaseService,
    private readonly matchmakingService: MatchmakingService,
  ) {}

  /**
   * Widen matchmaking windows and expire stale entries.
   * Runs every 5 seconds.
   */
  @Cron('*/5 * * * * *')
  async scanMatchmakingQueue(): Promise<void> {
    try {
      const snapshot = await this.firebase
        .collection('matchmakingQueue')
        .where('status', '==', 'waiting')
        .limit(100)
        .get();

      if (snapshot.empty) return;

      const now = Date.now();
      const batch = this.firebase.batch();
      let updates = 0;

      for (const doc of snapshot.docs) {
        const entry = doc.data() as MatchmakingEntry;
        const waitTime = now - new Date(entry.joinedAt).getTime();
        const waitSec = waitTime / 1000;

        // Expire after timeout
        if (waitSec >= MULTIPLAYER_DEFAULTS.MATCHMAKING_EXPIRE_SEC) {
          batch.update(doc.ref, { status: 'expired' });
          updates++;
          continue;
        }

        // Widen rating window
        const widenSteps = Math.floor(waitSec / MULTIPLAYER_DEFAULTS.MATCHMAKING_WIDEN_INTERVAL_SEC);
        const newWindowMin = entry.skillRating - MULTIPLAYER_DEFAULTS.INITIAL_RATING_WINDOW -
          (widenSteps * MULTIPLAYER_DEFAULTS.RATING_WINDOW_STEP);
        const newWindowMax = entry.skillRating + MULTIPLAYER_DEFAULTS.INITIAL_RATING_WINDOW +
          (widenSteps * MULTIPLAYER_DEFAULTS.RATING_WINDOW_STEP);

        // Clamp window
        const clampedMin = Math.max(MULTIPLAYER_DEFAULTS.RATING_FLOOR, newWindowMin);
        const clampedMax = Math.min(entry.skillRating + MULTIPLAYER_DEFAULTS.RATING_WINDOW_MAX, newWindowMax);

        if (clampedMin !== entry.ratingWindowMin || clampedMax !== entry.ratingWindowMax) {
          batch.update(doc.ref, {
            ratingWindowMin: clampedMin,
            ratingWindowMax: clampedMax,
          });
          updates++;
        }
      }

      if (updates > 0) {
        await batch.commit();
        this.logger.debug(`Matchmaking scan: ${updates} entries updated`);
      }

      // After widening windows, try to match waiting players
      const waitingEntries = snapshot.docs
        .filter(doc => (doc.data() as MatchmakingEntry).status === 'waiting')
        .map(doc => ({ id: doc.id, ...(doc.data() as MatchmakingEntry) }));

      for (const entry of waitingEntries) {
        try {
          const result = await this.matchmakingService.tryMatchPlayer(
            entry.id, entry.uid, entry.gameId, entry.skillRating,
            'Player', null, // displayName/avatar not needed for session creation from cron
          );
          if (result) {
            this.logger.log(`Cron matched ${entry.uid} → session ${result}`);
            break; // One match per scan cycle to avoid race conditions
          }
        } catch (e) {
          // tryMatchPlayer may fail if entry was already matched — ignore
        }
      }
    } catch (error) {
      this.logger.error(`Matchmaking scan failed: ${(error as Error).message}`);
    }
  }

  /**
   * Clean up abandoned sessions (no heartbeat for 5 min in waiting, 2 min in playing).
   * Runs every minute.
   */
  @Cron('0 * * * * *')
  async cleanupSessions(): Promise<void> {
    try {
      const now = Date.now();
      let cleaned = 0;

      // Cleanup waiting sessions idle for 5 minutes
      const waitingSessions = await this.firebase
        .collection('sessions')
        .where('status', '==', 'waiting')
        .limit(50)
        .get();

      const batch = this.firebase.batch();
      for (const doc of waitingSessions.docs) {
        const session = doc.data() as Session;
        const idleMs = now - new Date(session.lastActivityAt).getTime();
        if (idleMs > MULTIPLAYER_DEFAULTS.LOBBY_IDLE_TIMEOUT_MS) {
          batch.update(doc.ref, {
            status: 'abandoned',
            finishedAt: new Date(),
          });
          cleaned++;
        }
      }

      if (cleaned > 0) {
        await batch.commit();
        this.logger.log(`Session cleanup: ${cleaned} abandoned sessions`);
      }
    } catch (error) {
      this.logger.error(`Session cleanup failed: ${(error as Error).message}`);
    }
  }

  /**
   * Anti-cheat scan: detect win-trading, abnormal streaks, rating manipulation.
   * Runs every 6 hours.
   */
  @Cron('0 0 */6 * * *')
  async antiCheatScan(): Promise<void> {
    try {
      this.logger.log('Anti-cheat scan started');

      const recentResults = await this.firebase
        .collection('matchResults')
        .orderBy('finishedAt', 'desc')
        .limit(500)
        .get();

      if (recentResults.empty) return;

      // Track player-pair win patterns for win-trading detection
      const pairWins = new Map<string, { wins: number[]; losses: number[] }>();

      for (const doc of recentResults.docs) {
        const result = doc.data();
        const uids = Object.keys(result.players || {});

        if (uids.length === 2) {
          const pairKey = uids.sort().join(':');
          if (!pairWins.has(pairKey)) {
            pairWins.set(pairKey, { wins: [], losses: [] });
          }
          const pair = pairWins.get(pairKey)!;
          const winner = uids.find(uid => result.players[uid]?.outcome === 'win');
          if (winner) {
            pair.wins.push(uids.indexOf(winner));
          }
        }
      }

      // Detect alternating wins (win-trading)
      const reports: Array<{ type: string; details: string }> = [];
      for (const [pairKey, pair] of pairWins) {
        if (pair.wins.length >= MULTIPLAYER_DEFAULTS.WIN_TRADE_CHECK_GAMES) {
          // Check if wins alternate
          let alternating = 0;
          for (let i = 1; i < pair.wins.length; i++) {
            if (pair.wins[i] !== pair.wins[i - 1]) alternating++;
          }
          const alternatingRatio = alternating / (pair.wins.length - 1);
          if (alternatingRatio > 0.8) {
            reports.push({
              type: 'win_trading',
              details: `Pair ${pairKey}: ${pair.wins.length} games, ${Math.round(alternatingRatio * 100)}% alternating`,
            });
          }
        }
      }

      if (reports.length > 0) {
        await this.firebase.collection('antiCheatReports').add({
          scanDate: new Date(),
          reports,
          gamesScanned: recentResults.size,
        });
        this.logger.warn(`Anti-cheat scan: ${reports.length} issues found`);
      } else {
        this.logger.log('Anti-cheat scan: no issues found');
      }
    } catch (error) {
      this.logger.error(`Anti-cheat scan failed: ${(error as Error).message}`);
    }
  }
}
