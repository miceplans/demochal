import {
  IsDateString,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

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

  // recruitMethod는 수정할 수 없다(생성 시점 고정) — 기존 공고가 external일 때만 서비스
  // 레벨에서 반영하고, seMOchall 공고에 보내진 값은 무시한다.
  // Omission leaves the existing link untouched, but an explicit null must not
  // erase an external posting's application link.
  @ValidateIf((_, value) => value !== undefined)
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2048)
  recruitUrl?: string;
}
