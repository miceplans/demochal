import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class InviteTeamDto {
  @IsUUID()
  userId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  role?: string;

  // 스카우트 제안 메시지(사람찾기). 팀당 스카우트는 3회까지다.
  @IsOptional()
  @IsString()
  @MaxLength(200)
  message?: string;
}
