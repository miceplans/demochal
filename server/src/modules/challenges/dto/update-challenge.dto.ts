import { Type } from 'class-transformer';
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
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { CHALLENGE_ORGANIZER_TYPES, CHALLENGE_TARGETS } from '../utils/challenge-filter-options.js';
import { ApplicationFormQuestionDto } from './application-form-question.dto.js';

/** 공고 부분 수정. businessId/status는 바꿀 수 없다(상태는 PATCH /challenges/:id/status). */
export class UpdateChallengeDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  capacity?: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

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
}
