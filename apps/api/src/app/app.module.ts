import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FirebaseModule } from '../firebase/firebase.module';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { GameStateModule } from '../game-state/game-state.module';
import { LeaderboardModule } from '../leaderboard/leaderboard.module';
import { AchievementsModule } from '../achievements/achievements.module';
import { CustomizationsModule } from '../customizations/customizations.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MultiplayerModule } from '../multiplayer/multiplayer.module';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';

@Module({
  imports: [
    // Rate limiting: 100 requests per minute globally
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000, // 1 second
        limit: 5, // 5 requests per second
      },
      {
        name: 'medium',
        ttl: 60000, // 1 minute
        limit: 100, // 100 requests per minute
      },
      {
        name: 'long',
        ttl: 3600000, // 1 hour
        limit: 1000, // 1000 requests per hour
      },
    ]),
    ScheduleModule.forRoot(),
    FirebaseModule,
    AuthModule,
    UsersModule,
    GameStateModule,
    LeaderboardModule,
    AchievementsModule,
    CustomizationsModule,
    NotificationsModule,
    MultiplayerModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: FirebaseAuthGuard,
    },
    // Global rate limiting guard
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
