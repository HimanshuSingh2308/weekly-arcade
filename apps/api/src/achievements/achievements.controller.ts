import {
  Controller,
  Get,
  Post,
  Body,
  Query,
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
  async getMyAchievements(
    @CurrentUser() authUser: AuthUser,
    @Query('limit') limit?: string,
    @Query('startAfter') startAfter?: string
  ): Promise<UserAchievement[]> {
    const limitNum = limit ? parseInt(limit, 10) : 50;
    return this.achievementsService.getUserAchievements(authUser.uid, limitNum, startAfter);
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
