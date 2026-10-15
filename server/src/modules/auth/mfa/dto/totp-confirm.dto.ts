import { IsOptional, IsString, Matches } from 'class-validator';

export class ConfirmTotpDto {
  @Matches(/^\d{6}$/, { message: '인증 코드는 6자리 숫자입니다.' })
  code!: string;

  // 쿠키 세션 대신 mfa-enroll 토큰으로 진입하는 경우에만 본다(MfaAuthGuard가 검증).
  @IsOptional()
  @IsString()
  mfaToken?: string;
}
