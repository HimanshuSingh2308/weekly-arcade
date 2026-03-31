import { Module } from '@nestjs/common';
import { FirebaseModule } from './firebase/firebase.module';
import { GameModule } from './game/game.module';
import { PresenceModule } from './presence/presence.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    FirebaseModule,
    GameModule,
    PresenceModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
