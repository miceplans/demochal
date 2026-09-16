import { IsArray, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class ApplyChallengeDto {
  @IsUUID()
  challengeId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  role?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  teammates?: string[];
}
