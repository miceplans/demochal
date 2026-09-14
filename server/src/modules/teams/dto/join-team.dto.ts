import { IsOptional, IsString, MaxLength } from 'class-validator';

export class JoinTeamDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  role?: string;
}
