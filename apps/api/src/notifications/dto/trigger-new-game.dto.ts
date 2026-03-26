import { IsString, IsOptional } from 'class-validator';

export class TriggerNewGameDto {
  @IsString()
  gameId: string;

  @IsString()
  gameName: string;

  @IsString()
  @IsOptional()
  gameIcon?: string;
}
