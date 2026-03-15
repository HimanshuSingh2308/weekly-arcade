import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { UsersService } from '../users/users.service';
import { LeaderboardEntry, LeaderboardPeriod, ScoreRecord } from '@weekly-arcade/shared';
import { SubmitScoreDto } from './dto';

@Injectable()
export class LeaderboardService {
  private readonly logger = new Logger(LeaderboardService.name);
  private readonly scoresCollection = 'scores';
  private readonly leaderboardsCollection = 'leaderboards';
  private readonly usersCollection = 'users';

  constructor(
    private readonly firebaseService: FirebaseService,
    private readonly usersService: UsersService
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

    // Get user info
    const user = await this.usersService.getProfile(uid);

    // Create score record
    const scoreRecord: Omit<ScoreRecord, 'id'> = {
      odId: '', // Will be set after creation
      odName: user.displayName,
      odAvatarUrl: user.avatarUrl,
      gameId,
      score: submitDto.score,
      guessCount: submitDto.guessCount,
      level: submitDto.level,
      timeMs: submitDto.timeMs,
      metadata: submitDto.metadata,
      createdAt: now,
    };

    // Save to scores collection
    const scoreRef = await this.firebaseService.collection(this.scoresCollection).add({
      ...scoreRecord,
      odId: uid,
    });

    // Update leaderboards for all periods
    const periods: LeaderboardPeriod[] = ['daily', 'weekly', 'monthly', 'allTime'];
    const updatePromises = periods.map((period) =>
      this.updateLeaderboard(uid, gameId, period, submitDto.score, user.displayName, user.avatarUrl)
    );
    await Promise.all(updatePromises);

    // Calculate XP earned
    const xpEarned = this.calculateXP(submitDto);
    await this.usersService.addXP(uid, xpEarned);

    // Get rank for today
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

    // Perfect game bonus
    if (submitDto.metadata?.perfectGame) {
      xp *= 1.5;
    }

    // Streak bonus
    if (submitDto.metadata?.streakBonus) {
      xp += submitDto.metadata.streakBonus;
    }

    return Math.floor(Math.max(10, xp)); // Minimum 10 XP
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
  }

  async getLeaderboard(
    gameId: string,
    period: LeaderboardPeriod,
    limit = 50
  ): Promise<LeaderboardEntry[]> {
    const dateKey = this.getDateKey(period);
    const leaderboardId = `${gameId}_${period}_${dateKey}`;
    const doc = await this.firebaseService
      .doc(`${this.leaderboardsCollection}/${leaderboardId}`)
      .get();

    if (!doc.exists) {
      return [];
    }

    const data = doc.data() as { entries: LeaderboardEntry[] };
    return (data.entries || []).slice(0, limit);
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
}
