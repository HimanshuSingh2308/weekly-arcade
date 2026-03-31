import { Module } from '@nestjs/common';
import { LeaderboardController } from './leaderboard.controller';
import { LeaderboardService } from './leaderboard.service';
import { UsersModule } from '../users/users.module';
import { AuthModule } from '../auth/auth.module';
import { CustomizationsModule } from '../customizations/customizations.module';

@Module({
  imports: [UsersModule, AuthModule, CustomizationsModule],
  controllers: [LeaderboardController],
  providers: [LeaderboardService],
  exports: [LeaderboardService],
})
export class LeaderboardModule {}
