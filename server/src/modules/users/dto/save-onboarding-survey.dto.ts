import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

export class SaveOnboardingSurveyDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  interests?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  purposes?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  challengeTypes?: string[];
}
