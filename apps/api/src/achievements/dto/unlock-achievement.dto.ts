import { IsString, IsOptional, IsObject } from 'class-validator';

export class UnlockAchievementDto {
  @IsString()
  achievementId: string;

  @IsString()
  @IsOptional()
  gameId?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
