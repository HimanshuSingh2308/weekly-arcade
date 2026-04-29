import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Req,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { MultiplayerService } from './multiplayer.service';
import { SessionParticipantGuard } from './guards/session-participant.guard';
import { CreateSessionDto } from './dto/create-session.dto';
import { JoinByCodeDto } from './dto/join-session.dto';

@Controller('multiplayer/sessions')
export class MultiplayerController {
  constructor(private readonly multiplayerService: MultiplayerService) {}

  @Post()
  async createSession(@Req() req: any, @Body() dto: CreateSessionDto) {
    const { uid, displayName, avatarUrl } = req.user;
    return this.multiplayerService.createSession(uid, displayName || 'Player', avatarUrl || null, dto);
  }

  @Post('quick-join')
  @HttpCode(200)
  async quickJoin(@Req() req: any, @Body() body: { gameId: string; gameConfig?: Record<string, unknown> }) {
    const { uid, displayName, avatarUrl } = req.user;
    return this.multiplayerService.quickJoin(uid, displayName || 'Player', avatarUrl || null, body.gameId, body.gameConfig || {});
  }

  @Get('active')
  async getActiveSessions(@Req() req: any) {
    return this.multiplayerService.getActiveSessionsForUser(req.user.uid);
  }

  @Get(':sessionId')
  async getSession(@Param('sessionId') sessionId: string) {
    return this.multiplayerService.getSession(sessionId);
  }

  @Post(':sessionId/join')
  @HttpCode(200)
  async joinSession(@Param('sessionId') sessionId: string, @Req() req: any) {
    const { uid, displayName, avatarUrl } = req.user;
    return this.multiplayerService.joinSession(sessionId, uid, displayName || 'Player', avatarUrl || null);
  }

  @Post('join-code/:code')
  @HttpCode(200)
  async joinByCode(@Param('code') code: string, @Req() req: any) {
    const { uid, displayName, avatarUrl } = req.user;
    return this.multiplayerService.joinByCode(code, uid, displayName || 'Player', avatarUrl || null);
  }

  @Post(':sessionId/leave')
  @UseGuards(SessionParticipantGuard)
  @HttpCode(200)
  async leaveSession(@Param('sessionId') sessionId: string, @Req() req: any) {
    await this.multiplayerService.leaveSession(sessionId, req.user.uid);
    return { success: true };
  }

  @Post(':sessionId/start')
  @UseGuards(SessionParticipantGuard)
  @HttpCode(200)
  async startGame(@Param('sessionId') sessionId: string, @Req() req: any) {
    await this.multiplayerService.startGame(sessionId, req.user.uid);
    return { success: true };
  }

  @Post(':sessionId/kick/:targetUid')
  @UseGuards(SessionParticipantGuard)
  @HttpCode(200)
  async kickPlayer(
    @Param('sessionId') sessionId: string,
    @Param('targetUid') targetUid: string,
    @Req() req: any,
  ) {
    await this.multiplayerService.kickPlayer(sessionId, req.user.uid, targetUid);
    return { success: true };
  }
}
