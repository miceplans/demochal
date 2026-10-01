import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsOptional,
  IsUUID,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

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
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
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

  // 한 줄 소개. 빈 문자열은 소개 삭제로 취급한다.
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(100)
  bio?: string;

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

  // files.id (public 버킷에 finalize된 본인 이미지). null이면 프로필 이미지를 삭제한다.
  @IsOptional()
  @IsUUID()
  profileImageFileId?: string | null;
}
