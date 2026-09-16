import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';

export class ExternalLinkDto {
  @IsString()
  @MaxLength(50)
  label!: string;

  @IsString()
  @MaxLength(500)
  url!: string;
}

export class AwardRecordDto {
  @IsString()
  @MaxLength(200)
  title!: string;

  @IsString()
  @MaxLength(200)
  organization!: string;

  @IsString()
  @MaxLength(50)
  date!: string;

  @IsString()
  @MaxLength(50)
  prize!: string;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  // NOTE: request field is named `role` in the spec, but its description ("포지션") and the
  // `User.position` schema field make clear it targets the profile position, not the
  // account role (user | business | admin) — that must stay out of self-service reach.
  @IsOptional()
  @IsString()
  @MaxLength(100)
  role?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
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
