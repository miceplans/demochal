import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsPositive,
  IsUrl,
  Min,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { CHALLENGE_ORGANIZER_TYPES, CHALLENGE_TARGETS } from '../challenge-filter-options.js';

export class CreateChallengeDto {
  @IsUUID()
  businessId!: string;

  @IsString()
  @MaxLength(200)
  title!: string;

  @IsString()
  @MaxLength(20_000)
  description!: string;

  @IsInt()
  @Min(0)
  price!: number;

  @IsInt()
  @IsPositive()
  capacity!: number;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @IsOptional()
  @IsIn(['seMOchall', 'external'])
  recruitMethod?: 'seMOchall' | 'external';

  // 공개(published)/비공개(draft). 생략하면 `contestAutoPublish` 설정을 따른다.
  @IsOptional()
  @IsIn(['draft', 'published'])
  status?: 'draft' | 'published';

  // recruitMethod가 external(기본값 포함)이면 필수 — 서비스 레벨에서 검사한다.
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2048)
  recruitUrl?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(CHALLENGE_TARGETS, { each: true })
  targets?: string[];

  @IsOptional()
  @IsIn(CHALLENGE_ORGANIZER_TYPES)
  organizerType?: string;

  // 총상금(만원)
  @IsOptional()
  @IsInt()
  @Min(0)
  prizeAmount?: number;

  @IsOptional()
  @IsUUID()
  posterFileId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  summary?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  hashtags?: string[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  topics?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  inquiryContact?: string;

  @IsOptional()
  @IsIn(['public', 'private'])
  visibility?: 'public' | 'private';
}
