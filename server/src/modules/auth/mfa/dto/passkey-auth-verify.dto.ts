import { IsObject } from 'class-validator';
import type { AuthenticationResponseJSON } from '@simplewebauthn/server';
import { MfaTokenDto } from './mfa-token.dto.js';

export class PasskeyAuthVerifyDto extends MfaTokenDto {
  @IsObject()
  credential!: AuthenticationResponseJSON;
}
