import { Module } from '@nestjs/common';
import { MultiplayerController } from './multiplayer.controller';
import { MultiplayerService } from './multiplayer.service';
import { MatchmakingController } from './matchmaking.controller';
import { MatchmakingService } from './matchmaking.service';
import { MatchmakingCron } from './matchmaking.cron';
import { InvitationController } from './invitation.controller';
import { InvitationService } from './invitation.service';
import { InternalController } from './internal.controller';

@Module({
  controllers: [
    MultiplayerController,
    MatchmakingController,
    InvitationController,
    InternalController,
  ],
  providers: [
    MultiplayerService,
    MatchmakingService,
    MatchmakingCron,
    InvitationService,
  ],
  exports: [MultiplayerService, MatchmakingService],
})
export class MultiplayerModule {}
