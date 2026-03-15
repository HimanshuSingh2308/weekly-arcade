import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FirebaseModule } from '../firebase/firebase.module';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { GameStateModule } from '../game-state/game-state.module';
import { LeaderboardModule } from '../leaderboard/leaderboard.module';
import { AchievementsModule } from '../achievements/achievements.module';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';

@Module({
  imports: [
    FirebaseModule,
    AuthModule,
    UsersModule,
    GameStateModule,
    LeaderboardModule,
    AchievementsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: FirebaseAuthGuard,
    },
  ],
})
export class AppModule {}
