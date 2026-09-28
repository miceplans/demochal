import {
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

  // recruitMethod가 external(기본값 포함)이면 필수 — 서비스 레벨에서 검사한다(recruitMethod
  // 미지정 시 기본값으로 external이 적용되므로 DTO만으로는 상호 검증이 어렵다).
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2048)
  recruitUrl?: string;
}
