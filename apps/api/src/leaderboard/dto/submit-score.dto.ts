import { IsString, IsNumber, IsOptional, Min, IsObject } from 'class-validator';

export class SubmitScoreDto {
  @IsNumber()
  @Min(0)
  score: number;

  @IsNumber()
  @IsOptional()
  @Min(1)
  guessCount?: number;

  @IsNumber()
  @IsOptional()
  @Min(1)
  level?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  timeMs?: number;

  @IsString()
  @IsOptional()
  wordHash?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
