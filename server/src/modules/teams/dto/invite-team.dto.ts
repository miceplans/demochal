import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class InviteTeamDto {
  @IsUUID()
  userId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  role?: string;
}
