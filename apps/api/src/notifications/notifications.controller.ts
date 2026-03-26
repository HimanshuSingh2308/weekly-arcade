import {
  Controller,
  Post,
  Delete,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsCron } from './notifications.cron';
import { CurrentUser, AuthUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { ApiKeyGuard } from './guards/api-key.guard';
import { RegisterTokenDto, TriggerNewGameDto } from './dto';

@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly notificationsCron: NotificationsCron
  ) {}

  /**
   * Get notification config (VAPID key) — public endpoint
   */
  @Get('config')
  @Public()
  getConfig(): { vapidKey: string } {
    return { vapidKey: process.env.FCM_VAPID_KEY || '' };
  }

  /**
   * Register a push notification token for the current user
   */
  @Post('token')
  @HttpCode(HttpStatus.OK)
  async registerToken(
    @CurrentUser() authUser: AuthUser,
    @Body() dto: RegisterTokenDto
  ): Promise<{ success: boolean }> {
    await this.notificationsService.registerToken(authUser.uid, dto.token, dto.deviceInfo);
    return { success: true };
  }

  /**
   * Remove a push notification token
   */
  @Delete('token')
  @HttpCode(HttpStatus.OK)
  async removeToken(
    @CurrentUser() authUser: AuthUser,
    @Body() dto: RegisterTokenDto
  ): Promise<{ success: boolean }> {
    await this.notificationsService.removeToken(authUser.uid, dto.token);
    return { success: true };
  }

  /**
   * Get notification status for current user
   */
  @Get('status')
  async getStatus(@CurrentUser() authUser: AuthUser): Promise<{
    tokenCount: number;
    withinFrequencyCap: boolean;
  }> {
    const [tokenCount, withinFrequencyCap] = await Promise.all([
      this.notificationsService.getTokenCount(authUser.uid),
      this.notificationsService.checkFrequencyCap(authUser.uid),
    ]);
    return { tokenCount, withinFrequencyCap };
  }

  /**
   * Trigger new game notification to all opted-in users
   * Secured by API key (called from deploy workflow)
   */
  @Post('new-game')
  @Public()
  @UseGuards(ApiKeyGuard)
  @HttpCode(HttpStatus.OK)
  async triggerNewGameNotification(
    @Body() dto: TriggerNewGameDto
  ): Promise<{ sent: number; failed: number }> {
    return this.notificationsService.sendToAllOptedIn(
      `New Game: ${dto.gameName}!`,
      `A new game just dropped! Be the first on the leaderboard.`,
      'new_game',
      { gameId: dto.gameId, action: 'open_game' }
    );
  }

  /**
   * Trigger streak reminders (called by Cloud Scheduler)
   */
  @Post('cron/streaks')
  @Public()
  @UseGuards(ApiKeyGuard)
  @HttpCode(HttpStatus.OK)
  async triggerStreakReminders(): Promise<{ atRisk: number; milestones: number }> {
    return this.notificationsCron.handleStreakReminders();
  }

  /**
   * Trigger weekly leaderboard updates (called by Cloud Scheduler)
   */
  @Post('cron/leaderboard')
  @Public()
  @UseGuards(ApiKeyGuard)
  @HttpCode(HttpStatus.OK)
  async triggerLeaderboardUpdates(): Promise<{ sent: number }> {
    return this.notificationsCron.handleWeeklyLeaderboardUpdates();
  }
}
