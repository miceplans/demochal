import {
  ArrayUnique,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { CHALLENGE_ORGANIZER_TYPES, CHALLENGE_TARGETS } from '../challenge-filter-options.js';

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
}
