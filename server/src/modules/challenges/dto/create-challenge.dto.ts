import {
  ArrayUnique,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsPositive,
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
}
