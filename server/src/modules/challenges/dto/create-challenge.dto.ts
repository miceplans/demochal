import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

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
  @IsPositive()
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
}
