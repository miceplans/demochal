import { IsEmail, IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export const BUSINESS_TYPES = ['기업', '학교', '비영리', '협회'] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number];

export class RegisterBusinessDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @Matches(/^\d{10}$/)
  registrationNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @IsIn(BUSINESS_TYPES)
  type!: BusinessType;
}
