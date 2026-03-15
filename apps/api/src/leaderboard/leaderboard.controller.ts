import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { LeaderboardService } from './leaderboard.service';
import { CurrentUser, AuthUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { SubmitScoreDto } from './dto';
import { LeaderboardEntry, LeaderboardPeriod } from '@weekly-arcade/shared';

@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  /**
   * Submit a score for a game
   */
  @Post(':gameId/submit')
  @HttpCode(HttpStatus.OK)
  async submitScore(
    @CurrentUser() authUser: AuthUser,
    @Param('gameId') gameId: string,
    @Body() submitDto: SubmitScoreDto
  ): Promise<{ scoreId: string; rank: number; xpEarned: number }> {
    return this.leaderboardService.submitScore(authUser.uid, gameId, submitDto);
  }

  /**
   * Get leaderboard for a game and period
   * This endpoint is public so guests can view leaderboards
   */
  @Get(':gameId/:period')
  @Public()
  async getLeaderboard(
    @Param('gameId') gameId: string,
    @Param('period') period: LeaderboardPeriod,
    @Query('limit') limit?: string
  ): Promise<LeaderboardEntry[]> {
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    return this.leaderboardService.getLeaderboard(gameId, period, parsedLimit);
  }

  /**
   * Get friends leaderboard for a game
   */
  @Get(':gameId/:period/friends')
  async getFriendsLeaderboard(
    @CurrentUser() authUser: AuthUser,
    @Param('gameId') gameId: string,
    @Param('period') period: LeaderboardPeriod
  ): Promise<LeaderboardEntry[]> {
    return this.leaderboardService.getFriendsLeaderboard(authUser.uid, gameId, period);
  }

  /**
   * Get current user's rank for a game and period
   */
  @Get(':gameId/:period/rank')
  async getMyRank(
    @CurrentUser() authUser: AuthUser,
    @Param('gameId') gameId: string,
    @Param('period') period: LeaderboardPeriod
  ): Promise<{ rank: number; score: number }> {
    const result = await this.leaderboardService.getUserRankWithScore(authUser.uid, gameId, period);
    return result;
  }
}
