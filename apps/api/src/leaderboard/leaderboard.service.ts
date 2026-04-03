import { Injectable, Logger, BadRequestException, ForbiddenException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { FirebaseService } from '../firebase/firebase.service';
import { UsersService } from '../users/users.service';
import { AuthService } from '../auth/auth.service';
import { CustomizationsService } from '../customizations/customizations.service';
import { LeaderboardEntry, LeaderboardPeriod, ScoreRecord, User } from '@weekly-arcade/shared';
import { SubmitScoreDto } from './dto';
import { validateScore, ValidationResult } from './config/game-config';

// Helper to remove undefined values (Firestore doesn't accept undefined)
function removeUndefined<T extends object>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, v]) => v !== undefined)
  ) as T;
}

@Injectable()
export class LeaderboardService {
  private readonly logger = new Logger(LeaderboardService.name);
  // "od" prefix = "operator display" — public-facing user identifier (maps to Firebase UID)
  private readonly scoresCollection = 'scores';
  private readonly leaderboardsCollection = 'leaderboards';
  private readonly usersCollection = 'users';

  // In-memory leaderboard cache: key → { entries, expiry timestamp }
  // Capped at MAX_CACHE_ENTRIES to prevent unbounded memory growth.
  private readonly leaderboardCache = new Map<string, { data: LeaderboardEntry[]; expiry: number }>();
  private readonly CACHE_TTL_MS = 60_000; // 60 seconds
  private readonly MAX_CACHE_ENTRIES = 500;

  // Score submission dedup cache: prevents duplicate writes from network retries.
  // Key: "uid_gameId_score", Value: expiry timestamp. Window: 10 seconds.
  private readonly scoreDedup = new Map<string, number>();
  private readonly DEDUP_WINDOW_MS = 10_000;

  constructor(
    private readonly firebaseService: FirebaseService,
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
    private readonly customizationsService: CustomizationsService,
  ) {}

  private getDateKey(period: LeaderboardPeriod, date: Date = new Date()): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    switch (period) {
      case 'daily':
        return `${year}-${month}-${day}`;
      case 'weekly':
        // Get ISO week number — use the ISO year (year of the Thursday), not calendar year
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const isoYear = d.getUTCFullYear();
        const yearStart = new Date(Date.UTC(isoYear, 0, 1));
        const weekNum = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
        return `${isoYear}-W${String(weekNum).padStart(2, '0')}`;
      case 'monthly':
        return `${year}-${month}`;
      case 'allTime':
        return 'all-time';
      default:
        return `${year}-${month}-${day}`;
    }
  }

  async submitScore(
    uid: string,
    gameId: string,
    submitDto: SubmitScoreDto
  ): Promise<{ scoreId: string; rank: number; xpEarned: number }> {
    const now = new Date();

    // Idempotency: reject duplicate submissions within a 10s window
    const dedupKey = `${uid}_${gameId}_${submitDto.score}`;
    const dedupExpiry = this.scoreDedup.get(dedupKey);
    if (dedupExpiry && Date.now() < dedupExpiry) {
      throw new BadRequestException('Duplicate score submission — please wait before resubmitting');
    }
    this.scoreDedup.set(dedupKey, Date.now() + this.DEDUP_WINDOW_MS);
    // Lazy cleanup: remove expired dedup entries
    if (this.scoreDedup.size > 10_000) {
      const cutoff = Date.now();
      for (const [key, exp] of this.scoreDedup) {
        if (exp < cutoff) this.scoreDedup.delete(key);
      }
    }

    // SECURITY: Validate score against game-specific rules
    const validationResult = this.validateScoreSubmission(gameId, submitDto);
    if (!validationResult.valid) {
      this.logger.warn(
        `[SECURITY] Invalid score submission from user ${uid} for ${gameId}: ${validationResult.reason}`,
        { uid, gameId, score: submitDto.score, timeMs: submitDto.timeMs }
      );
      throw new ForbiddenException(`Invalid score: ${validationResult.reason}`);
    }

    // Get user info, or create a basic profile if user doesn't exist yet
    let user: User;
    try {
      user = await this.usersService.getProfile(uid);
    } catch (error) {
      // User doesn't exist - create a basic profile
      this.logger.warn(`User ${uid} not found, creating basic profile for score submission`);
      user = await this.authService.createOrUpdateUser(uid, {
        email: `${uid}@unknown.com`,
        displayName: 'Player',
        avatarUrl: null,
      });
    }

    // Create score record (remove undefined values for Firestore)
    const scoreRecord = removeUndefined({
      odId: uid,
      odName: user.displayName,
      odAvatarUrl: user.avatarUrl ?? null,
      gameId,
      score: submitDto.score,
      guessCount: submitDto.guessCount ?? null,
      level: submitDto.level ?? null,
      timeMs: submitDto.timeMs ?? null,
      metadata: submitDto.metadata ?? null,
      createdAt: now,
    });

    // Calculate XP before writes so we can parallelize
    const xpEarned = this.calculateXP(submitDto);
    const coinsEarned = Math.min(50, Math.floor(submitDto.score / 100));

    // Save score doc + update all 4 leaderboard periods + XP in parallel
    const periods: LeaderboardPeriod[] = ['daily', 'weekly', 'monthly', 'allTime'];
    const [scoreRef] = await Promise.all([
      this.firebaseService.collection(this.scoresCollection).add(scoreRecord),
      ...periods.map((period) =>
        this.updateLeaderboard(uid, gameId, period, submitDto.score, user.displayName, user.avatarUrl)
      ),
      this.usersService.addXP(uid, xpEarned),
    ]);

    // Fire-and-forget: coins + play streak (non-critical, don't block response)
    if (coinsEarned > 0) {
      this.customizationsService
        .addCoins(uid, {
          amount: coinsEarned,
          type: 'game_reward',
          gameId,
          description: `Score reward for ${gameId}`,
        })
        .catch((err) => this.logger.warn(`Failed to award coins to ${uid}: ${err.message}`));
    }
    this.usersService.updatePlayStreak(uid).catch((err) =>
      this.logger.warn(`Failed to update play streak for ${uid}: ${err.message}`)
    );

    // Get rank (uses cached leaderboard data when available)
    const rank = await this.getUserRank(uid, gameId, 'daily');

    this.logger.log(`Score submitted for user ${uid}, game ${gameId}. XP: ${xpEarned}, Rank: ${rank}`);

    return {
      scoreId: scoreRef.id,
      rank,
      xpEarned,
    };
  }

  private calculateXP(submitDto: SubmitScoreDto): number {
    // Base XP from score
    let xp = Math.floor(submitDto.score * 0.1);

    // Bonus for fewer guesses (Wordle-specific, only if guessCount provided)
    if (submitDto.guessCount !== undefined && submitDto.guessCount > 0) {
      const guessBonus = Math.max(0, (7 - submitDto.guessCount) * 10);
      xp += guessBonus;
    }

    // Level bonus (for games like Snake, 2048, Chaos Kitchen)
    if (submitDto.level !== undefined && submitDto.level > 1) {
      xp += submitDto.level * 5;
    }

    // Perfect game bonus (validate it's a boolean, not a truthy arbitrary value)
    if (submitDto.metadata?.perfectGame === true) {
      xp *= 1.5;
    }

    // Streak bonus (capped to prevent client-side injection)
    if (typeof submitDto.metadata?.streakBonus === 'number' && submitDto.metadata.streakBonus > 0) {
      xp += Math.min(submitDto.metadata.streakBonus, 100);
    }

    return Math.floor(Math.max(10, xp)); // Minimum 10 XP
  }

  /**
   * SECURITY: Validate score submission against game-specific rules
   * Prevents cheating by enforcing realistic limits on scores
   */
  private validateScoreSubmission(gameId: string, submitDto: SubmitScoreDto): ValidationResult {
    return validateScore(gameId, {
      score: submitDto.score,
      timeMs: submitDto.timeMs,
      level: submitDto.level,
      guessCount: submitDto.guessCount,
      metadata: submitDto.metadata,
    });
  }

  /**
   * Write the user's best score to a subcollection entry.
   * Each user gets their own document — no contention between concurrent players.
   */
  private async updateLeaderboard(
    uid: string,
    gameId: string,
    period: LeaderboardPeriod,
    score: number,
    displayName: string,
    avatarUrl: string | null
  ): Promise<void> {
    const dateKey = this.getDateKey(period);
    const leaderboardId = `${gameId}_${period}_${dateKey}`;
    const entryRef = this.firebaseService.doc(
      `${this.leaderboardsCollection}/${leaderboardId}/entries/${uid}`
    );

    const existing = await entryRef.get();

    // For ELO-based games (chess-3d), always write the latest rating
    // For other games, only write if new score is higher
    const isEloGame = gameId === 'chess-3d';
    const shouldWrite = !existing.exists || isEloGame || score > (existing.data()?.score || 0);
    if (shouldWrite) {
      await entryRef.set({
        odId: uid,
        odName: displayName || '',
        odAvatarUrl: avatarUrl || null,
        score,
        updatedAt: new Date(),
      });

      // Ensure parent doc exists with static metadata (only on first write)
      if (!existing.exists) {
        const parentRef = this.firebaseService.doc(`${this.leaderboardsCollection}/${leaderboardId}`);
        await parentRef.set({ gameId, period, dateKey }, { merge: true });
      }

      // Invalidate cache for this leaderboard
      this.leaderboardCache.delete(leaderboardId);
    }
  }

  async getLeaderboard(
    gameId: string,
    period: LeaderboardPeriod,
    limit = 50
  ): Promise<LeaderboardEntry[]> {
    const dateKey = this.getDateKey(period);
    const leaderboardId = `${gameId}_${period}_${dateKey}`;

    // Check in-memory cache first
    const cached = this.leaderboardCache.get(leaderboardId);
    if (cached && Date.now() < cached.expiry) {
      return cached.data.slice(0, limit);
    }

    // Query subcollection ordered by score
    const snapshot = await this.firebaseService
      .collection(`${this.leaderboardsCollection}/${leaderboardId}/entries`)
      .orderBy('score', 'desc')
      .limit(limit)
      .get();

    if (snapshot.empty) {
      return [];
    }

    // Resolve display names from user profiles
    const rawEntries = snapshot.docs.map((doc) => doc.data());
    const userIds = rawEntries.map((e) => e.odId as string);
    const profiles = await this.batchGetUserProfiles(userIds);

    const entries: LeaderboardEntry[] = rawEntries.map((entry, index) => ({
      odId: entry.odId,
      odName: profiles.get(entry.odId)?.displayName || 'Player',
      odAvatarUrl: profiles.get(entry.odId)?.avatarUrl || null,
      score: entry.score,
      rank: index + 1,
      level: entry.level,
      updatedAt: entry.updatedAt?.toDate ? entry.updatedAt.toDate() : entry.updatedAt,
    }));

    // Store in cache (with size cap + eviction of expired entries)
    this.evictCacheIfNeeded();
    this.leaderboardCache.set(leaderboardId, {
      data: entries,
      expiry: Date.now() + this.CACHE_TTL_MS,
    });

    return entries;
  }

  /**
   * Evict expired entries first; if still over limit, evict oldest entries (LRU).
   * Map preserves insertion order, so first entries are oldest.
   */
  private evictCacheIfNeeded(): void {
    if (this.leaderboardCache.size < this.MAX_CACHE_ENTRIES) return;

    const now = Date.now();
    // Pass 1: remove expired
    for (const [key, value] of this.leaderboardCache) {
      if (value.expiry < now) {
        this.leaderboardCache.delete(key);
      }
    }

    // Pass 2: if still over limit, remove oldest (first inserted)
    while (this.leaderboardCache.size >= this.MAX_CACHE_ENTRIES) {
      const oldest = this.leaderboardCache.keys().next().value;
      if (oldest) this.leaderboardCache.delete(oldest);
      else break;
    }
  }

  async getFriendsLeaderboard(
    uid: string,
    gameId: string,
    period: LeaderboardPeriod
  ): Promise<LeaderboardEntry[]> {
    // Get user's friends
    const friends = await this.usersService.getFriends(uid);
    const friendUids = friends.map((f) => f.uid);
    friendUids.push(uid); // Include self

    const dateKey = this.getDateKey(period);
    const leaderboardId = `${gameId}_${period}_${dateKey}`;
    const entriesPath = `${this.leaderboardsCollection}/${leaderboardId}/entries`;

    // Single round-trip batch read of all friends' entries
    const entryRefs = friendUids.map((fid) => this.firebaseService.doc(`${entriesPath}/${fid}`));
    const entryDocs = await this.firebaseService.getAll(...entryRefs);

    // Filter to friends who have entries, collect scores
    const rawEntries = entryDocs
      .filter((doc) => doc.exists)
      .map((doc) => doc.data()!)
      .sort((a, b) => b.score - a.score);

    if (rawEntries.length === 0) return [];

    // Resolve display names
    const userIds = rawEntries.map((e) => e.odId as string);
    const profiles = await this.batchGetUserProfiles(userIds);

    return rawEntries.map((entry, index) => ({
      odId: entry.odId,
      odName: profiles.get(entry.odId)?.displayName || 'Player',
      odAvatarUrl: profiles.get(entry.odId)?.avatarUrl || null,
      score: entry.score,
      rank: index + 1,
      level: entry.level,
      updatedAt: entry.updatedAt?.toDate ? entry.updatedAt.toDate() : entry.updatedAt,
    }));
  }

  /**
   * Get user's rank by counting how many entries have a higher score.
   * Works for ALL users, not just top 100.
   */
  async getUserRank(uid: string, gameId: string, period: LeaderboardPeriod): Promise<number> {
    const dateKey = this.getDateKey(period);
    const leaderboardId = `${gameId}_${period}_${dateKey}`;
    const entriesPath = `${this.leaderboardsCollection}/${leaderboardId}/entries`;

    const userEntry = await this.firebaseService.doc(`${entriesPath}/${uid}`).get();
    if (!userEntry.exists) return 0;

    const userScore = userEntry.data()?.score || 0;

    // Count entries with a higher score
    const higherCount = await this.firebaseService
      .collection(entriesPath)
      .where('score', '>', userScore)
      .count()
      .get();

    return higherCount.data().count + 1;
  }

  async getUserRankWithScore(
    uid: string,
    gameId: string,
    period: LeaderboardPeriod
  ): Promise<{ rank: number; score: number }> {
    const dateKey = this.getDateKey(period);
    const leaderboardId = `${gameId}_${period}_${dateKey}`;
    const entriesPath = `${this.leaderboardsCollection}/${leaderboardId}/entries`;

    const userEntry = await this.firebaseService.doc(`${entriesPath}/${uid}`).get();
    if (!userEntry.exists) return { rank: 0, score: 0 };

    const userScore = userEntry.data()?.score || 0;

    const higherCount = await this.firebaseService
      .collection(entriesPath)
      .where('score', '>', userScore)
      .count()
      .get();

    return {
      rank: higherCount.data().count + 1,
      score: userScore,
    };
  }

  // ============ USER PROFILE RESOLUTION ============

  /**
   * Batch-fetch user profiles in a single Firestore RPC round-trip.
   * Returns a Map of uid → { displayName, avatarUrl }.
   */
  private async batchGetUserProfiles(
    uids: string[]
  ): Promise<Map<string, { displayName: string; avatarUrl: string | null }>> {
    const profiles = new Map<string, { displayName: string; avatarUrl: string | null }>();
    if (uids.length === 0) return profiles;

    // Deduplicate
    const uniqueUids = [...new Set(uids)];

    // Single round-trip batch read via Firestore getAll()
    const refs = uniqueUids.map((uid) =>
      this.firebaseService.doc(`${this.usersCollection}/${uid}`)
    );
    const docs = await this.firebaseService.getAll(...refs);

    for (const doc of docs) {
      if (doc.exists) {
        const data = doc.data() as User;
        profiles.set(data.uid, {
          displayName: data.displayName || 'Player',
          avatarUrl: data.avatarUrl || null,
        });
      }
    }

    return profiles;
  }

  // ============ SCORES ARCHIVAL ============

  /**
   * Weekly cron: consolidate scores older than 90 days into per-user-per-game
   * summaries in `scoreArchives`, then delete the raw score documents.
   * Runs every Sunday at 3 AM.
   */
  @Cron('0 3 * * 0')
  async archiveOldScores(): Promise<void> {
    const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    this.logger.log(`Starting scores archival — consolidating scores before ${cutoffDate.toISOString()}`);

    // Phase 1: Read all old scores and group by user+game
    const summaries = new Map<string, {
      odId: string;
      gameId: string;
      totalGames: number;
      bestScore: number;
      totalScore: number;
      bestLevel: number;
      bestTimeMs: number | null; // lowest time = best
      firstPlayed: Date;
      lastPlayed: Date;
    }>();

    let totalRead = 0;
    let hasMore = true;
    let lastDoc: FirebaseFirestore.DocumentSnapshot | undefined;

    while (hasMore) {
      let query = this.firebaseService
        .collection(this.scoresCollection)
        .where('createdAt', '<', cutoffDate)
        .orderBy('createdAt', 'asc')
        .limit(500);

      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }

      const snapshot = await query.get();

      if (snapshot.empty) {
        hasMore = false;
        break;
      }

      for (const doc of snapshot.docs) {
        const data = doc.data();
        const key = `${data.odId}_${data.gameId}`;
        const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt);

        const existing = summaries.get(key);
        if (existing) {
          existing.totalGames += 1;
          existing.totalScore += data.score || 0;
          existing.bestScore = Math.max(existing.bestScore, data.score || 0);
          existing.bestLevel = Math.max(existing.bestLevel, data.level || 0);
          if (data.timeMs != null) {
            existing.bestTimeMs = existing.bestTimeMs != null
              ? Math.min(existing.bestTimeMs, data.timeMs)
              : data.timeMs;
          }
          if (createdAt < existing.firstPlayed) existing.firstPlayed = createdAt;
          if (createdAt > existing.lastPlayed) existing.lastPlayed = createdAt;
        } else {
          summaries.set(key, {
            odId: data.odId,
            gameId: data.gameId,
            totalGames: 1,
            bestScore: data.score || 0,
            totalScore: data.score || 0,
            bestLevel: data.level || 0,
            bestTimeMs: data.timeMs ?? null,
            firstPlayed: createdAt,
            lastPlayed: createdAt,
          });
        }
      }

      totalRead += snapshot.size;
      lastDoc = snapshot.docs[snapshot.docs.length - 1];
      this.logger.log(`Read ${totalRead} old scores so far...`);
    }

    if (totalRead === 0) {
      this.logger.log('No scores to archive');
      return;
    }

    // Phase 2: Upsert consolidated summaries into scoreArchives collection
    // Uses transactions per doc to handle min/max merges without separate reads
    let archivedCount = 0;

    for (const [key, summary] of summaries) {
      const archiveRef = this.firebaseService.doc(`scoreArchives/${key}`);

      await this.firebaseService.runTransaction(async (transaction) => {
        const existingDoc = await transaction.get(archiveRef);

        if (existingDoc.exists) {
          const prev = existingDoc.data()!;
          const newTotalGames = (prev.totalGames || 0) + summary.totalGames;
          const newTotalScore = (prev.totalScore || 0) + summary.totalScore;
          transaction.set(archiveRef, {
            odId: summary.odId,
            gameId: summary.gameId,
            totalGames: newTotalGames,
            bestScore: Math.max(prev.bestScore || 0, summary.bestScore),
            totalScore: newTotalScore,
            avgScore: Math.round(newTotalScore / newTotalGames),
            bestLevel: Math.max(prev.bestLevel || 0, summary.bestLevel),
            bestTimeMs: prev.bestTimeMs != null && summary.bestTimeMs != null
              ? Math.min(prev.bestTimeMs, summary.bestTimeMs)
              : prev.bestTimeMs ?? summary.bestTimeMs,
            firstPlayed: (prev.firstPlayed?.toDate?.() || prev.firstPlayed) < summary.firstPlayed
              ? prev.firstPlayed
              : summary.firstPlayed,
            lastPlayed: (prev.lastPlayed?.toDate?.() || prev.lastPlayed) > summary.lastPlayed
              ? prev.lastPlayed
              : summary.lastPlayed,
            updatedAt: new Date(),
          });
        } else {
          transaction.set(archiveRef, {
            ...summary,
            avgScore: Math.round(summary.totalScore / summary.totalGames),
            updatedAt: new Date(),
          });
        }
      });

      archivedCount++;
      if (archivedCount % 100 === 0) {
        this.logger.log(`Upserted ${archivedCount}/${summaries.size} archive summaries...`);
      }
    }

    // Phase 3: Delete the raw score documents
    let totalDeleted = 0;
    hasMore = true;

    while (hasMore) {
      const snapshot = await this.firebaseService
        .collection(this.scoresCollection)
        .where('createdAt', '<', cutoffDate)
        .limit(500)
        .get();

      if (snapshot.empty) {
        hasMore = false;
        break;
      }

      const batch = this.firebaseService.batch();
      for (const doc of snapshot.docs) {
        batch.delete(doc.ref);
      }
      await batch.commit();

      totalDeleted += snapshot.size;
      this.logger.log(`Deleted ${totalDeleted} raw scores so far...`);
    }

    this.logger.log(
      `Scores archival complete — consolidated ${summaries.size} user-game summaries, deleted ${totalDeleted} raw scores`
    );
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}
