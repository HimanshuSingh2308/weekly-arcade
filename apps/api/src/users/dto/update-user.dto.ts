import { IsBoolean, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateUserDto {
  @IsString()
  @MinLength(1)
  @IsOptional()
  displayName?: string;

  @IsString()
  @IsOptional()
  avatarUrl?: string;
}

export class UpdateSettingsDto {
  @IsBoolean()
  @IsOptional()
  soundEnabled?: boolean;

  @IsEnum(['dark', 'light', 'system'])
  @IsOptional()
  theme?: 'dark' | 'light' | 'system';

  @IsBoolean()
  @IsOptional()
  notificationsEnabled?: boolean;
}

export class AddFriendDto {
  @IsString()
  friendUid: string;
}
