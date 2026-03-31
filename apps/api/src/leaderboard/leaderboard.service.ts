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
  private readonly leaderboardCache = new Map<string, { data: LeaderboardEntry[]; expiry: number }>();
  private readonly CACHE_TTL_MS = 60_000; // 60 seconds

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
        // Get ISO week number
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        const weekNum = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
        return `${year}-W${String(weekNum).padStart(2, '0')}`;
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

    // Save to scores collection
    const scoreRef = await this.firebaseService.collection(this.scoresCollection).add(scoreRecord);

    // Update leaderboards for all periods
    const periods: LeaderboardPeriod[] = ['daily', 'weekly', 'monthly', 'allTime'];
    const updatePromises = periods.map((period) =>
      this.updateLeaderboard(uid, gameId, period, submitDto.score, user.displayName, user.avatarUrl)
    );
    await Promise.all(updatePromises);

    // Calculate XP earned
    const xpEarned = this.calculateXP(submitDto);
    await this.usersService.addXP(uid, xpEarned);

    // Award coins server-side based on score (replaces client-callable /coins/add)
    const coinsEarned = Math.min(50, Math.floor(submitDto.score / 100));
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

    // Get rank for today
    const rank = await this.getUserRank(uid, gameId, 'daily');

    // Update play streak (fire-and-forget)
    this.usersService.updatePlayStreak(uid).catch((err) =>
      this.logger.warn(`Failed to update play streak for ${uid}: ${err.message}`)
    );

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
    const leaderboardRef = this.firebaseService.doc(`${this.leaderboardsCollection}/${leaderboardId}`);

    await this.firebaseService.runTransaction(async (transaction) => {
      const doc = await transaction.get(leaderboardRef);

      let entries: LeaderboardEntry[] = [];
      if (doc.exists) {
        entries = (doc.data() as { entries: LeaderboardEntry[] }).entries || [];
      }

      // Find existing entry for this user
      const existingIndex = entries.findIndex((e) => e.odId === uid);

      if (existingIndex >= 0) {
        // Update if new score is higher
        if (score > entries[existingIndex].score) {
          entries[existingIndex] = {
            ...entries[existingIndex],
            score,
            updatedAt: new Date(),
          };
        }
      } else {
        // Add new entry
        entries.push({
          odId: uid,
          odName: displayName,
          odAvatarUrl: avatarUrl,
          score,
          rank: 0, // Will be recalculated
          updatedAt: new Date(),
        });
      }

      // Sort by score descending
      entries.sort((a, b) => b.score - a.score);

      // Deduplicate by user ID (keep highest score entry)
      const seenUsers = new Set<string>();
      entries = entries.filter((entry) => {
        if (!entry.odId || seenUsers.has(entry.odId)) {
          return false;
        }
        seenUsers.add(entry.odId);
        return true;
      });

      // Update ranks and keep top 100
      entries = entries.slice(0, 100).map((entry, index) => ({
        ...entry,
        rank: index + 1,
      }));

      transaction.set(leaderboardRef, {
        gameId,
        period,
        dateKey,
        entries,
        updatedAt: new Date(),
      });
    });

    // Invalidate cache for this leaderboard
    this.leaderboardCache.delete(leaderboardId);
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

    const doc = await this.firebaseService
      .doc(`${this.leaderboardsCollection}/${leaderboardId}`)
      .get();

    if (!doc.exists) {
      return [];
    }

    const data = doc.data() as { entries: LeaderboardEntry[] };
    const entries = data.entries || [];

    // Store in cache
    this.leaderboardCache.set(leaderboardId, {
      data: entries,
      expiry: Date.now() + this.CACHE_TTL_MS,
    });

    return entries.slice(0, limit);
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
    const doc = await this.firebaseService
      .doc(`${this.leaderboardsCollection}/${leaderboardId}`)
      .get();

    if (!doc.exists) {
      return [];
    }

    const data = doc.data() as { entries: LeaderboardEntry[] };
    const entries = data.entries || [];

    // Filter to only friends
    const friendEntries = entries.filter((e) => friendUids.includes(e.odId));

    // Re-rank within friends
    return friendEntries.map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));
  }

  async getUserRank(uid: string, gameId: string, period: LeaderboardPeriod): Promise<number> {
    const dateKey = this.getDateKey(period);
    const leaderboardId = `${gameId}_${period}_${dateKey}`;
    const doc = await this.firebaseService
      .doc(`${this.leaderboardsCollection}/${leaderboardId}`)
      .get();

    if (!doc.exists) {
      return 0;
    }

    const data = doc.data() as { entries: LeaderboardEntry[] };
    const entry = (data.entries || []).find((e) => e.odId === uid);

    return entry?.rank || 0;
  }

  async getUserRankWithScore(
    uid: string,
    gameId: string,
    period: LeaderboardPeriod
  ): Promise<{ rank: number; score: number }> {
    const dateKey = this.getDateKey(period);
    const leaderboardId = `${gameId}_${period}_${dateKey}`;
    const doc = await this.firebaseService
      .doc(`${this.leaderboardsCollection}/${leaderboardId}`)
      .get();

    if (!doc.exists) {
      return { rank: 0, score: 0 };
    }

    const data = doc.data() as { entries: LeaderboardEntry[] };
    const entry = (data.entries || []).find((e) => e.odId === uid);

    return {
      rank: entry?.rank || 0,
      score: entry?.score || 0,
    };
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
    // Merge with any existing archive (from prior runs)
    let archivedCount = 0;
    const archiveBatches = this.chunkArray(Array.from(summaries.entries()), 500);

    for (const chunk of archiveBatches) {
      const batch = this.firebaseService.batch();

      for (const [key, summary] of chunk) {
        const archiveRef = this.firebaseService.doc(`scoreArchives/${key}`);
        const existingDoc = await archiveRef.get();

        if (existingDoc.exists) {
          const prev = existingDoc.data()!;
          batch.set(archiveRef, {
            odId: summary.odId,
            gameId: summary.gameId,
            totalGames: (prev.totalGames || 0) + summary.totalGames,
            bestScore: Math.max(prev.bestScore || 0, summary.bestScore),
            totalScore: (prev.totalScore || 0) + summary.totalScore,
            avgScore: Math.round(
              ((prev.totalScore || 0) + summary.totalScore) /
              ((prev.totalGames || 0) + summary.totalGames)
            ),
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
          batch.set(archiveRef, {
            ...summary,
            avgScore: Math.round(summary.totalScore / summary.totalGames),
            updatedAt: new Date(),
          });
        }
      }

      await batch.commit();
      archivedCount += chunk.length;
      this.logger.log(`Upserted ${archivedCount} archive summaries...`);
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
