import { Matches } from 'class-validator';
import { MfaTokenDto } from './mfa-token.dto.js';

export class VerifyTotpDto extends MfaTokenDto {
  @Matches(/^\d{6}$/, { message: '인증 코드는 6자리 숫자입니다.' })
  code!: string;
}
