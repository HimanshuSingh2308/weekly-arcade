import { Module } from '@nestjs/common';
import { FirebaseModule } from './firebase/firebase.module';
import { GameModule } from './game/game.module';
import { PresenceModule } from './presence/presence.module';
import { MatchmakingModule } from './matchmaking/matchmaking.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    FirebaseModule,
    GameModule,
    PresenceModule,
    MatchmakingModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
