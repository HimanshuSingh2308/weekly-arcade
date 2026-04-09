import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Req,
  Param,
  HttpCode,
} from '@nestjs/common';
import { MatchmakingService } from './matchmaking.service';
import { FindMatchDto } from './dto/join-session.dto';

@Controller('multiplayer/matchmaking')
export class MatchmakingController {
  constructor(private readonly matchmakingService: MatchmakingService) {}

  @Post('find')
  async findMatch(@Req() req: any, @Body() dto: FindMatchDto) {
    const { uid, displayName, avatarUrl } = req.user;
    return this.matchmakingService.findMatch(uid, displayName || 'Player', avatarUrl || null, dto.gameId);
  }

  @Delete('cancel')
  @HttpCode(200)
  async cancelMatchmaking(@Req() req: any) {
    await this.matchmakingService.cancelMatchmaking(req.user.uid);
    return { success: true };
  }

  @Get('status')
  async getStatus(@Req() req: any) {
    return this.matchmakingService.getStatus(req.user.uid);
  }

  @Get('rating/:gameId')
  async getRating(@Req() req: any, @Param('gameId') gameId: string) {
    const rating = await this.matchmakingService.getPlayerRating(req.user.uid, gameId);
    const gameRatingDoc = await this.matchmakingService.getPlayerRatingStats(req.user.uid, gameId);
    return {
      rating,
      wins: gameRatingDoc?.wins || 0,
      losses: gameRatingDoc?.losses || 0,
      draws: gameRatingDoc?.draws || 0,
      gamesPlayed: gameRatingDoc?.gamesPlayed || 0,
    };
  }
}
