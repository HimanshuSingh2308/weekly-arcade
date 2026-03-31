import { IsString, IsInt, IsOptional, IsObject, Min, Max, IsIn } from 'class-validator';

export class CreateSessionDto {
  @IsString()
  gameId: string;

  @IsIn(['quick-match', 'private'])
  mode: 'quick-match' | 'private';

  @IsInt()
  @Min(2)
  @Max(20)
  maxPlayers: number;

  @IsInt()
  @Min(2)
  @Max(20)
  @IsOptional()
  minPlayers?: number;

  @IsObject()
  @IsOptional()
  gameConfig?: Record<string, unknown>;

  @IsOptional()
  spectatorAllowed?: boolean;
}
