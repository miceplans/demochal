import { IsArray, IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

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

  @IsOptional()
  @IsArray()
  @IsObject({ each: true })
  formAnswers?: Record<string, unknown>[];
}
