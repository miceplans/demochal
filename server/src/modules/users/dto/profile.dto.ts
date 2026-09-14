import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class ExternalLinkDto {
  @IsString()
  label!: string;

  @IsString()
  url!: string;
}

export class AwardRecordDto {
  @IsString()
  title!: string;

  @IsString()
  organization!: string;

  @IsString()
  date!: string;

  @IsString()
  prize!: string;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  name?: string;

  /** Profile position (기획/디자인/개발 등) — client contract calls it "role". */
  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  stacks?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExternalLinkDto)
  externalLinks?: ExternalLinkDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AwardRecordDto)
  awardHistory?: AwardRecordDto[];
}

export class SaveSurveyDto {
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
