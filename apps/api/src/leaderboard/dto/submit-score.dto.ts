import { IsString, IsNumber, IsOptional, Min, Max, IsObject } from 'class-validator';

export class SubmitScoreDto {
  @IsNumber()
  @Min(0)
  score: number;

  @IsNumber()
  @Min(1)
  @Max(6)
  guessCount: number;

  @IsNumber()
  @Min(1)
  level: number;

  @IsNumber()
  @Min(0)
  timeMs: number;

  @IsString()
  @IsOptional()
  wordHash?: string;

  @IsObject()
  @IsOptional()
  metadata?: {
    hintsUsed?: number;
    perfectGame?: boolean;
    streakBonus?: number;
  };
}
