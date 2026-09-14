import { IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator';

const TYPES = ['비영리', '학교', '협회', '기업'] as const;

export class RegisterBusinessDto {
  @IsString()
  @MaxLength(200)
  name!: string;

  @IsString()
  @Length(10, 10)
  registrationNumber!: string;

  // Not in the documented request schema — needed for the type filter/column on
  // BizReviewEntry (`/admin/businesses`), which otherwise has no data source.
  @IsOptional()
  @IsIn(TYPES)
  type?: (typeof TYPES)[number];
}
