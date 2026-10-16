import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsUrl,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { CHALLENGE_ORGANIZER_TYPES, CHALLENGE_TARGETS } from '../challenge-filter-options.js';
import { ChallengeAttachmentDto, MAX_CHALLENGE_ATTACHMENTS } from './challenge-attachment.dto.js';
import { ApplicationFormQuestionDto } from './application-form-question.dto.js';

/** 공고 부분 수정. businessId/status는 바꿀 수 없다(상태는 PATCH /challenges/:id/status). */
export class UpdateChallengeDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100_000)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  // null이면 행사 기간을 비운다.
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsDateString()
  eventStartDate?: string | null;

  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsDateString()
  eventEndDate?: string | null;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  host?: string;

  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(200)
  supervisor?: string | null;

  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(200)
  sponsor?: string | null;

  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(200)
  supporter?: string | null;

  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(100)
  targetOther?: string | null;

  // 첨부파일 목록 전체 교체. 빈 배열이면 모두 제거한다.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_CHALLENGE_ATTACHMENTS)
  @ValidateNested({ each: true })
  @Type(() => ChallengeAttachmentDto)
  attachments?: ChallengeAttachmentDto[];

  // null이면 카테고리를 비운다.
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(100)
  category?: string | null;

  // Omission leaves the existing link untouched, but an explicit null must not
  // erase an external posting's application link.
  @ValidateIf((_, value) => value !== undefined)
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2048)
  recruitUrl?: string;

  // null이면 값을 비운다.
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsArray()
  @ArrayUnique()
  @IsIn(CHALLENGE_TARGETS, { each: true })
  targets?: string[] | null;

  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsIn(CHALLENGE_ORGANIZER_TYPES)
  organizerType?: string | null;

  // 총상금(만원). null이면 비운다.
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsInt()
  @Min(0)
  prizeAmount?: number | null;

  // null이면 포스터를 제거한다.
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsUUID()
  posterFileId?: string | null;
  // biz 콘솔 "신청서(질문지) 만들기" 화면에서 작성한 질문 목록. 작성한 경우에만 전체를 교체한다.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ApplicationFormQuestionDto)
  applicationForm?: ApplicationFormQuestionDto[];

  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(300)
  summary?: string | null;

  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  hashtags?: string[] | null;

  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  topics?: string[] | null;

  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(200)
  inquiryContact?: string | null;

  @IsOptional()
  @IsIn(['public', 'private'])
  visibility?: 'public' | 'private';
}
