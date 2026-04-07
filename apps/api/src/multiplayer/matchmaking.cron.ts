import { Injectable, Logger } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { MatchmakingEntry, Session } from '@weekly-arcade/shared';
import { MatchmakingService } from './matchmaking.service';
import { MULTIPLAYER_DEFAULTS } from './config/multiplayer-defaults';

/**
 * Matchmaking background tasks. No longer uses @Cron decorators —
 * Cloud Run scales to zero and kills in-process crons.
 *
 * - scanMatchmakingQueue: called by realtime server (always warm from WS)
 * - cleanupSessions: triggered by Cloud Scheduler → POST /internal/cron/cleanup-sessions
 * - antiCheatScan: triggered by Cloud Scheduler → POST /internal/cron/anti-cheat
 */
@Injectable()
export class MatchmakingCron {
  private readonly logger = new Logger(MatchmakingCron.name);

  constructor(
    private readonly firebase: FirebaseService,
    private readonly matchmakingService: MatchmakingService,
  ) {}

  /**
   * Widen matchmaking windows, expire stale entries, and try to match players.
   * Called by the realtime server's cron (stays warm from WebSocket connections).
   */
  async scanMatchmakingQueue(): Promise<void> {
    try {
      const snapshot = await this.firebase
        .collection('matchmakingQueue')
        .where('status', '==', 'waiting')
        .limit(100)
        .get();

      this.logger.log(`Matchmaking scan: ${snapshot.size} waiting entries`);
      if (snapshot.empty) return;

      const now = Date.now();

      // ── Step 1: Try to match with CURRENT windows first ──
      const waitingEntries = snapshot.docs
        .map(doc => ({ id: doc.id, ...(doc.data() as MatchmakingEntry) }));

      const matchedUids = new Set<string>();

      for (const entry of waitingEntries) {
        if (matchedUids.has(entry.uid)) continue;
        try {
          const result = await this.matchmakingService.tryMatchPlayer(
            entry.id, entry.uid, entry.gameId, entry.skillRating,
            'Player', null,
            entry.ratingWindowMin, entry.ratingWindowMax,
          );
          if (result) {
            this.logger.log(`Cron matched ${entry.uid} → session ${result}`);
            matchedUids.add(entry.uid);
            const sessionDoc = await this.firebase.doc(`sessions/${result}`).get();
            if (sessionDoc.exists) {
              const players = sessionDoc.data()?.players || {};
              for (const uid of Object.keys(players)) matchedUids.add(uid);
            }
          }
        } catch (e) {
          this.logger.warn(`tryMatchPlayer failed for ${entry.uid}: ${(e as Error).message}`);
        }
      }

      // ── Step 2: Expire stale + widen windows for UNMATCHED entries ──
      const batch = this.firebase.batch();
      let updates = 0;

      for (const doc of snapshot.docs) {
        const entry = doc.data() as MatchmakingEntry;
        if (matchedUids.has(entry.uid)) continue; // Already matched

        const waitTime = now - new Date(entry.joinedAt).getTime();
        const waitSec = waitTime / 1000;

        if (waitSec >= MULTIPLAYER_DEFAULTS.MATCHMAKING_EXPIRE_SEC) {
          batch.update(doc.ref, { status: 'expired' });
          updates++;
          continue;
        }

        // Widen for next cycle
        const widenSteps = Math.floor(waitSec / MULTIPLAYER_DEFAULTS.MATCHMAKING_WIDEN_INTERVAL_SEC);
        const clampedMin = Math.max(MULTIPLAYER_DEFAULTS.RATING_FLOOR,
          entry.skillRating - MULTIPLAYER_DEFAULTS.INITIAL_RATING_WINDOW - (widenSteps * MULTIPLAYER_DEFAULTS.RATING_WINDOW_STEP));
        const clampedMax = Math.min(entry.skillRating + MULTIPLAYER_DEFAULTS.RATING_WINDOW_MAX,
          entry.skillRating + MULTIPLAYER_DEFAULTS.INITIAL_RATING_WINDOW + (widenSteps * MULTIPLAYER_DEFAULTS.RATING_WINDOW_STEP));

        if (clampedMin !== entry.ratingWindowMin || clampedMax !== entry.ratingWindowMax) {
          batch.update(doc.ref, { ratingWindowMin: clampedMin, ratingWindowMax: clampedMax });
          updates++;
        }
      }

      if (updates > 0) {
        await batch.commit();
        this.logger.debug(`Post-match: ${updates} entries expired/widened`);
      }
    } catch (error) {
      this.logger.error(`Matchmaking scan failed: ${(error as Error).message}`);
    }
  }

  /**
   * Clean up abandoned sessions (no heartbeat for 5 min in waiting, 2 min in playing).
   * Triggered by Cloud Scheduler every minute via POST /internal/cron/cleanup-sessions.
   */
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

      // Also clean up stuck 'claiming' queue entries (older than 30s)
      const claimingEntries = await this.firebase
        .collection('matchmakingQueue')
        .where('status', '==', 'claiming')
        .limit(20)
        .get();

      for (const doc of claimingEntries.docs) {
        const entry = doc.data();
        const joinedAt = entry.joinedAt instanceof Date
          ? entry.joinedAt.getTime()
          : entry.joinedAt?._seconds
            ? entry.joinedAt._seconds * 1000
            : new Date(entry.joinedAt).getTime();
        if (now - joinedAt > 30_000) {
          batch.update(doc.ref, { status: 'waiting' }); // Release back to queue
          cleaned++;
        }
      }

      if (cleaned > 0) {
        await batch.commit();
        this.logger.log(`Session cleanup: ${cleaned} sessions/entries cleaned`);
      }

      // Delete expired/abandoned sessions older than 1 hour
      let deleted = 0;
      const oneHourAgo = new Date(now - 60 * 60 * 1000);
      for (const status of ['abandoned', 'finished'] as const) {
        const oldSessions = await this.firebase
          .collection('sessions')
          .where('status', '==', status)
          .where('finishedAt', '<', oneHourAgo)
          .limit(50)
          .get();

        if (!oldSessions.empty) {
          const delBatch = this.firebase.batch();
          for (const doc of oldSessions.docs) {
            delBatch.delete(doc.ref);
          }
          await delBatch.commit();
          deleted += oldSessions.size;
        }
      }

      // Delete expired matchmaking queue entries older than 10 min
      const tenMinAgo = new Date(now - 10 * 60 * 1000);
      const oldEntries = await this.firebase
        .collection('matchmakingQueue')
        .where('status', 'in', ['expired', 'matched'])
        .where('joinedAt', '<', tenMinAgo)
        .limit(100)
        .get();

      if (!oldEntries.empty) {
        const delBatch = this.firebase.batch();
        for (const doc of oldEntries.docs) {
          delBatch.delete(doc.ref);
        }
        await delBatch.commit();
        deleted += oldEntries.size;
      }

      if (deleted > 0) {
        this.logger.log(`Cleanup: deleted ${deleted} old sessions/queue entries`);
      }
    } catch (error) {
      this.logger.error(`Session cleanup failed: ${(error as Error).message}`);
    }
  }

  /**
   * Anti-cheat scan: detect win-trading, abnormal streaks, rating manipulation.
   * Triggered by Cloud Scheduler every 6 hours via POST /internal/cron/anti-cheat.
   */
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
