import { IsNotEmpty, IsString } from 'class-validator';

/** 로그인 검증(verify) 엔드포인트 공통 — body로 받는 10분 만료 MFA JWT. */
export class MfaTokenDto {
  @IsString()
  @IsNotEmpty()
  mfaToken!: string;
}
