import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationsCron } from './notifications.cron';
import { LeaderboardModule } from '../leaderboard/leaderboard.module';

@Module({
  imports: [LeaderboardModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsCron],
  exports: [NotificationsService],
})
export class NotificationsModule {}
