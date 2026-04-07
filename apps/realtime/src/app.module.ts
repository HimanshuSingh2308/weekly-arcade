import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { FirebaseModule } from './firebase/firebase.module';
import { GameModule } from './game/game.module';
import { PresenceModule } from './presence/presence.module';
import { MatchmakingModule } from './matchmaking/matchmaking.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    FirebaseModule,
    GameModule,
    PresenceModule,
    MatchmakingModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
