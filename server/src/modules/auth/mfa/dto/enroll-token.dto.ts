import { IsOptional, IsString, MaxLength } from 'class-validator';

/** 등록 시작 엔드포인트 — 쿠키 세션 대신 mfa-enroll 토큰으로 진입하는 경우에만 본다(MfaAuthGuard가 검증). */
export class EnrollTokenDto {
  @IsOptional()
  @IsString()
  mfaToken?: string;

  /** 이미 2FA 수단이 있는 계정이 수단을 추가·교체할 때 본인 확인용(세션 탈취만으로 수단을 바꾸지 못하게 한다). */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  password?: string;
}
