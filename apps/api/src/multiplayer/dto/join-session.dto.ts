import { IsString, IsOptional } from 'class-validator';

export class JoinByCodeDto {
  @IsString()
  code: string;
}

export class InviteFriendDto {
  @IsString()
  sessionId: string;

  @IsString()
  friendUid: string;
}

export class RespondInvitationDto {
  @IsString()
  action: 'accept' | 'decline';
}

export class FindMatchDto {
  @IsString()
  gameId: string;
}
