import { Injectable, Logger, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Achievement, ACHIEVEMENTS, ACHIEVEMENT_LIST } from '@weekly-arcade/shared';
import { UnlockAchievementDto } from './dto';

export interface UserAchievement {
  odId: string;
  achievementId: string;
  unlockedAt: Date;
  gameId?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AchievementsService {
  private readonly logger = new Logger(AchievementsService.name);
  private readonly achievementsCollection = 'achievements';

  constructor(
    private readonly firebaseService: FirebaseService,
    private readonly usersService: UsersService,
    @Inject(forwardRef(() => NotificationsService))
    private readonly notificationsService: NotificationsService
  ) {}

  async unlockAchievement(
    uid: string,
    unlockDto: UnlockAchievementDto
  ): Promise<{ achievement: Achievement; xpEarned: number; alreadyUnlocked: boolean }> {
    const { achievementId, gameId, metadata } = unlockDto;

    // Validate achievement exists
    const achievement = ACHIEVEMENTS[achievementId];
    if (!achievement) {
      throw new BadRequestException(`Unknown achievement: ${achievementId}`);
    }

    // Check if already unlocked
    const existingDoc = await this.firebaseService
      .doc(`${this.achievementsCollection}/${uid}_${achievementId}`)
      .get();

    if (existingDoc.exists) {
      return {
        achievement,
        xpEarned: 0,
        alreadyUnlocked: true,
      };
    }

    // Unlock the achievement
    const userAchievement: UserAchievement = {
      odId: uid,
      achievementId,
      unlockedAt: new Date(),
      gameId,
      metadata,
    };

    await this.firebaseService
      .doc(`${this.achievementsCollection}/${uid}_${achievementId}`)
      .set(userAchievement);

    // Award XP
    const xpEarned = achievement.xpReward;
    await this.usersService.addXP(uid, xpEarned);

    this.logger.log(`User ${uid} unlocked achievement: ${achievementId} (+${xpEarned} XP)`);

    // Send push notification (fire-and-forget)
    this.notificationsService
      .sendToUser(
        uid,
        'Achievement Unlocked!',
        `You earned "${achievement.name}" (+${xpEarned} XP)`,
        'achievement_unlocked',
        { achievementId, action: 'open_profile' }
      )
      .catch(() => {});

    return {
      achievement,
      xpEarned,
      alreadyUnlocked: false,
    };
  }

  async getUserAchievements(
    uid: string,
    limit = 50,
    startAfter?: string
  ): Promise<UserAchievement[]> {
    let query = this.firebaseService
      .collection(this.achievementsCollection)
      .where('odId', '==', uid)
      .orderBy('unlockedAt', 'desc')
      .limit(limit);

    if (startAfter) {
      query = query.startAfter(new Date(startAfter));
    }

    const snapshot = await query.get();
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        ...data,
        unlockedAt: data.unlockedAt?.toDate ? data.unlockedAt.toDate() : data.unlockedAt,
      } as UserAchievement;
    });
  }

  async getAchievementProgress(uid: string): Promise<{
    unlocked: Achievement[];
    locked: Achievement[];
    totalXP: number;
    completionPercentage: number;
  }> {
    const userAchievements = await this.getUserAchievements(uid);
    const unlockedIds = new Set(userAchievements.map((ua) => ua.achievementId));

    const unlocked = ACHIEVEMENT_LIST.filter((a) => unlockedIds.has(a.id));
    const locked = ACHIEVEMENT_LIST.filter((a) => !unlockedIds.has(a.id));

    const totalXP = unlocked.reduce((sum, a) => sum + a.xpReward, 0);
    const completionPercentage = Math.round((unlocked.length / ACHIEVEMENT_LIST.length) * 100);

    return {
      unlocked,
      locked,
      totalXP,
      completionPercentage,
    };
  }

  async checkAndUnlockAchievements(
    uid: string,
    gameId: string,
    stats: {
      gamesPlayed?: number;
      gamesWon?: number;
      currentStreak?: number;
      bestStreak?: number;
      perfectGames?: number;
      level?: number;
    }
  ): Promise<Achievement[]> {
    const newlyUnlocked: Achievement[] = [];
    const userAchievements = await this.getUserAchievements(uid);
    const unlockedIds = new Set(userAchievements.map((ua) => ua.achievementId));

    // Check each achievement condition
    for (const achievement of ACHIEVEMENT_LIST) {
      if (unlockedIds.has(achievement.id)) continue;

      let shouldUnlock = false;
      const req = achievement.requirement;

      // Check based on requirement type
      switch (req.type) {
        case 'first_game':
          shouldUnlock = (stats.gamesWon || 0) >= 1;
          break;
        case 'streak':
          shouldUnlock = (stats.currentStreak || 0) >= (req.value || 0);
          break;
        case 'level':
          shouldUnlock = (stats.level || 1) >= (req.value || 0);
          break;
        case 'wins':
          shouldUnlock = (stats.gamesWon || 0) >= (req.value || 0);
          break;
        case 'attempts':
          // Perfect game check - this would need to be passed in stats
          if (req.value === 1 && stats.perfectGames) {
            shouldUnlock = stats.perfectGames >= 1;
          }
          break;
      }

      if (shouldUnlock) {
        const result = await this.unlockAchievement(uid, {
          achievementId: achievement.id,
          gameId,
        });

        if (!result.alreadyUnlocked) {
          newlyUnlocked.push(achievement);
        }
      }
    }

    return newlyUnlocked;
  }
}
