import { IsOptional, IsString } from 'class-validator';

/** 등록 시작 엔드포인트 — 쿠키 세션 대신 mfa-enroll 토큰으로 진입하는 경우에만 본다(MfaAuthGuard가 검증). */
export class EnrollTokenDto {
  @IsOptional()
  @IsString()
  mfaToken?: string;
}
