import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Req,
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
}
