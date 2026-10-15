import { IsObject, IsOptional, IsString } from 'class-validator';
import type { RegistrationResponseJSON } from '@simplewebauthn/server';

export class PasskeyRegisterVerifyDto {
  @IsObject()
  credential!: RegistrationResponseJSON;

  // 쿠키 세션 대신 mfa-enroll 토큰으로 진입하는 경우에만 본다(MfaAuthGuard가 검증).
  @IsOptional()
  @IsString()
  mfaToken?: string;
}
