import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { MfaTokenDto } from './mfa-token.dto.js';

export class VerifyRecoveryDto extends MfaTokenDto {
  // XXXX-XXXX-XXXX 형식(하이픈 포함 14자) 또는 하이픈 없는 12자 모두 허용 — 서비스에서 정규화한다.
  @IsString()
  @IsNotEmpty()
  @MinLength(4)
  @MaxLength(20)
  code!: string;
}
