import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Req,
  HttpCode,
} from '@nestjs/common';
import { InvitationService } from './invitation.service';
import { InviteFriendDto, RespondInvitationDto } from './dto/join-session.dto';

@Controller('multiplayer/invitations')
export class InvitationController {
  constructor(private readonly invitationService: InvitationService) {}

  @Post()
  async sendInvitation(@Req() req: any, @Body() dto: InviteFriendDto) {
    const { uid, displayName } = req.user;
    // We need the gameId from the session, fetch it
    return this.invitationService.sendInvitation(
      uid,
      displayName || 'Player',
      dto.friendUid,
      dto.sessionId,
      '', // gameId will be resolved from session in a more complete impl
    );
  }

  @Get()
  async getInvitations(@Req() req: any) {
    return this.invitationService.getReceivedInvitations(req.user.uid);
  }

  @Post(':invitationId/respond')
  @HttpCode(200)
  async respond(
    @Param('invitationId') invitationId: string,
    @Req() req: any,
    @Body() dto: RespondInvitationDto,
  ) {
    return this.invitationService.respondToInvitation(invitationId, req.user.uid, dto.action);
  }
}
