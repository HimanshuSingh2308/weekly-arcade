import { Module } from '@nestjs/common';
import { MatchmakingGateway } from './matchmaking.gateway';
import { MatchmakingInternalController } from './matchmaking-internal.controller';

@Module({
  controllers: [MatchmakingInternalController],
  providers: [MatchmakingGateway],
  exports: [MatchmakingGateway],
})
export class MatchmakingModule {}
