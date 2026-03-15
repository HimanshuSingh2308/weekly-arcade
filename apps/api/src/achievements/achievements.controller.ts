import {
  Controller,
  Get,
  Post,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AchievementsService, UserAchievement } from './achievements.service';
import { CurrentUser, AuthUser } from '../auth/decorators/current-user.decorator';
import { UnlockAchievementDto } from './dto';
import { Achievement, ACHIEVEMENT_LIST } from '@weekly-arcade/shared';

@Controller('achievements')
export class AchievementsController {
  constructor(private readonly achievementsService: AchievementsService) {}

  /**
   * Get all available achievements
   */
  @Get()
  getAllAchievements(): Achievement[] {
    return ACHIEVEMENT_LIST;
  }

  /**
   * Get current user's unlocked achievements
   */
  @Get('me')
  async getMyAchievements(@CurrentUser() authUser: AuthUser): Promise<UserAchievement[]> {
    return this.achievementsService.getUserAchievements(authUser.uid);
  }

  /**
   * Get achievement progress for current user
   */
  @Get('progress')
  async getProgress(@CurrentUser() authUser: AuthUser): Promise<{
    unlocked: Achievement[];
    locked: Achievement[];
    totalXP: number;
    completionPercentage: number;
  }> {
    return this.achievementsService.getAchievementProgress(authUser.uid);
  }

  /**
   * Unlock an achievement
   */
  @Post('unlock')
  @HttpCode(HttpStatus.OK)
  async unlockAchievement(
    @CurrentUser() authUser: AuthUser,
    @Body() unlockDto: UnlockAchievementDto
  ): Promise<{ achievement: Achievement; xpEarned: number; alreadyUnlocked: boolean }> {
    return this.achievementsService.unlockAchievement(authUser.uid, unlockDto);
  }
}
