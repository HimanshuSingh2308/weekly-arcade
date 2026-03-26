import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NotificationsService } from './notifications.service';
import { LeaderboardService } from '../leaderboard/leaderboard.service';
import { FirebaseService } from '../firebase/firebase.service';

@Injectable()
export class NotificationsCron {
  private readonly logger = new Logger(NotificationsCron.name);
  private readonly usersCollection = 'users';

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly leaderboardService: LeaderboardService,
    private readonly firebaseService: FirebaseService
  ) {}

  /**
   * Daily at 18:00 UTC — streak reminders
   * Also callable via POST /notifications/cron/streaks (for Cloud Scheduler)
   */
  @Cron('30 12 * * *') // 6:00 PM IST (12:30 UTC)
  async handleStreakReminders(): Promise<{ atRisk: number; milestones: number }> {
    this.logger.log('Running streak reminder cron job');

    let atRiskCount = 0;
    let milestoneCount = 0;

    // Users who played yesterday but not today — streak at risk
    const atRiskUsers = await this.notificationsService.getUsersWithStreakAtRisk();
    for (const user of atRiskUsers) {
      const sent = await this.notificationsService.sendToUser(
        user.uid,
        "Don't lose your streak!",
        `You have a ${user.currentPlayStreak}-day streak going. Play today to keep it alive!`,
        'streak_reminder',
        { action: 'open_home' }
      );
      if (sent) atRiskCount++;
    }

    // Users who hit a milestone today
    const milestoneUsers = await this.notificationsService.getUsersWithStreakMilestones();
    for (const user of milestoneUsers) {
      const sent = await this.notificationsService.sendToUser(
        user.uid,
        `${user.currentPlayStreak}-day streak!`,
        `You played ${user.currentPlayStreak} days in a row! Keep it going!`,
        'streak_reminder',
        { action: 'open_home' }
      );
      if (sent) milestoneCount++;
    }

    this.logger.log(`Streak reminders: ${atRiskCount} at-risk, ${milestoneCount} milestones`);
    return { atRisk: atRiskCount, milestones: milestoneCount };
  }

  /**
   * Weekly on Monday at 09:00 UTC — leaderboard position updates
   * Also callable via POST /notifications/cron/leaderboard (for Cloud Scheduler)
   */
  @Cron('30 3 * * 1') // 9:00 AM IST Monday (03:30 UTC)
  async handleWeeklyLeaderboardUpdates(): Promise<{ sent: number }> {
    this.logger.log('Running weekly leaderboard update cron job');

    // Get all opted-in users
    const usersSnapshot = await this.firebaseService
      .collection(this.usersCollection)
      .where('settings.notificationsEnabled', '==', true)
      .get();

    // Known game IDs
    const gameIds = [
      '2048', 'chaos-kitchen', 'coin-cascade', 'fieldstone', 'lumble',
      'memory-match', 'snake', 'solitaire-roguelite', 'stack-tower',
      'tiny-tycoon', 'voidbreak', 'wordle',
    ];

    let sentCount = 0;

    for (const userDoc of usersSnapshot.docs) {
      const uid = userDoc.id;
      const displayName = userDoc.data().displayName || 'Player';

      // Find user's best ranking across all games for last week
      let bestRank = Infinity;
      let bestGame = '';

      for (const gameId of gameIds) {
        const { rank } = await this.leaderboardService.getUserRankWithScore(uid, gameId, 'weekly');
        if (rank > 0 && rank < bestRank) {
          bestRank = rank;
          bestGame = gameId;
        }
      }

      if (bestRank <= 50 && bestGame) {
        const gameName = bestGame
          .split('-')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ');

        const sent = await this.notificationsService.sendToUser(
          uid,
          'Weekly Leaderboard Recap',
          `You finished #${bestRank} in ${gameName} this week!`,
          'leaderboard_update',
          { gameId: bestGame, action: 'open_leaderboard' }
        );
        if (sent) sentCount++;
      }
    }

    this.logger.log(`Weekly leaderboard updates: ${sentCount} sent`);
    return { sent: sentCount };
  }
}
