import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export const BUSINESS_TYPES = ['기업', '학교', '비영리', '협회'] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number];

export class RegisterBusinessDto {
  // 기업 가입 폼(`/biz/login`)은 기관명·사업자번호를 받지 않는다 — 사업자등록증 OCR 결과나
  // 기업 프로필 편집에서 채운다.
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @Matches(/^\d{10}$/)
  registrationNumber?: string;

  @IsIn(BUSINESS_TYPES)
  type!: BusinessType;
}
