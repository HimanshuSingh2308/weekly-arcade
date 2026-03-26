import { IsString, IsOptional } from 'class-validator';

export class RegisterTokenDto {
  @IsString()
  token: string;

  @IsString()
  @IsOptional()
  deviceInfo?: string;
}
