import { IsString, IsNumber, IsOptional, IsObject, IsIn, Min } from 'class-validator';
import { CoinTransactionType } from '@weekly-arcade/shared';

export class AddCoinsDto {
  @IsNumber()
  @Min(1)
  amount: number;

  @IsString()
  @IsIn(['game_reward', 'achievement', 'purchase', 'iap', 'refund', 'admin'])
  type: CoinTransactionType;

  @IsString()
  gameId: string;

  @IsString()
  description: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
