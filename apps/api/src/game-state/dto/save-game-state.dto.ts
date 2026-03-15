import { IsString, IsNumber, IsObject, IsOptional, Min, IsArray } from 'class-validator';

export class SaveGameStateDto {
  @IsNumber()
  @Min(1)
  currentLevel: number;

  @IsNumber()
  @Min(0)
  currentStreak: number;

  @IsNumber()
  @Min(0)
  bestStreak: number;

  @IsNumber()
  @Min(0)
  gamesPlayed: number;

  @IsNumber()
  @Min(0)
  gamesWon: number;

  @IsObject()
  @IsOptional()
  guessDistribution?: Record<string, number>;

  @IsString()
  @IsOptional()
  lastPlayedDate?: string;

  @IsObject()
  @IsOptional()
  currentGameProgress?: {
    guesses: string[];
    targetWord?: string;
    isComplete: boolean;
    isWon: boolean;
  };

  @IsObject()
  @IsOptional()
  additionalData?: Record<string, unknown>;
}
