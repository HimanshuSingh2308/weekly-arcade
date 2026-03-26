import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Header,
} from '@nestjs/common';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
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
   * SECURITY: Rate limited to prevent score flooding and automated attacks
   * - 3 submissions per minute per user
   * - 10 submissions per hour per user
   */
  @Post(':gameId/submit')
  @HttpCode(HttpStatus.OK)
  @Throttle({
    short: { limit: 1, ttl: 5000 }, // 1 per 5 seconds
    medium: { limit: 3, ttl: 60000 }, // 3 per minute
    long: { limit: 30, ttl: 3600000 }, // 30 per hour
  })
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
   * Uses default rate limits (less restrictive for read operations)
   */
  @Get(':gameId/:period')
  @Public()
  @SkipThrottle({ short: true }) // Skip short throttle for read operations
  @Header('Cache-Control', 'public, max-age=60, stale-while-revalidate=30')
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
