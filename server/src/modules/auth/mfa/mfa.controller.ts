import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { MfaService } from './mfa.service.js';
import { MfaAuthGuard } from './mfa-auth.guard.js';
import { MfaFlow } from './mfa-flow.decorator.js';
import { ConfirmTotpDto } from './dto/totp-confirm.dto.js';
import { VerifyTotpDto } from './dto/verify-totp.dto.js';
import { VerifyRecoveryDto } from './dto/verify-recovery.dto.js';
import { PasswordConfirmDto } from './dto/password-confirm.dto.js';
import { EnrollTokenDto } from './dto/enroll-token.dto.js';
import { MfaTokenDto } from './dto/mfa-token.dto.js';
import { PasskeyRegisterVerifyDto } from './dto/passkey-register-verify.dto.js';
import { PasskeyAuthVerifyDto } from './dto/passkey-auth-verify.dto.js';
import { Public } from '../public.decorator.js';
import { CurrentUser } from '../current-user.decorator.js';
import type { AuthenticatedUser } from '../jwt-auth.guard.js';
import { AUTH_COOKIE_NAME, authCookieOptions } from '../auth.cookie.js';
import { AUTH_THROTTLE, LoginAttemptThrottlerGuard } from '../../../common/throttling/throttling.js';
import { SkipInputSecurity } from '../../../common/security/skip-input-security.decorator.js';

/**
 * 관리자·사업자 계정 2단계 인증. 전역 JwtAuthGuard를 물리화하기 위해 전체가 @Public()이고
 * 인증은 MfaAuthGuard(쿠키 세션 또는 body의 mfaToken)가 담당한다.
 */
@Public()
@UseGuards(MfaAuthGuard)
@Controller('auth/mfa')
export class MfaController {
  constructor(private readonly mfaService: MfaService) {}

  // ---------------------------------------------------------- 수단 관리·등록

  @Post('totp/setup')
  @MfaFlow('enroll')
  setupTotp(@Body() _dto: EnrollTokenDto, @CurrentUser() user: AuthenticatedUser) {
    return this.mfaService.setupTotp(user);
  }

  @Post('totp/confirm')
  @MfaFlow('enroll')
  async confirmTotp(
    @Body() dto: ConfirmTotpDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { recoveryCodes, firstMethod } = await this.mfaService.confirmTotp(user, dto.code);
    // 첫 수단 등록 완료는 로그인 처리까지 마쳤다는 뜻이므로 세션 쿠키를 발급한다.
    if (firstMethod) await this.setSessionCookie(user, response);
    return { recoveryCodes };
  }

  @Get('status')
  @MfaFlow('manage')
  status(@CurrentUser() user: AuthenticatedUser) {
    return this.mfaService.getStatus(user.id);
  }

  @Post('passkeys/register-options')
  @MfaFlow('enroll')
  registerOptions(@Body() _dto: EnrollTokenDto, @CurrentUser() user: AuthenticatedUser) {
    return this.mfaService.beginPasskeyRegistration(user);
  }

  // WebAuthn credential JSON은 base64url 값이라 `--` 같은 deny-list 시퀀스를 포함할 수 있다.
  // 프로토콜 파라미터를 암호학적으로 검증하는 simplewebauthn이 대신 방어하므로 입력 검사를 생략한다
  // (OAuth 콜백의 @SkipInputSecurity와 같은 사유).
  @SkipInputSecurity()
  @Post('passkeys/register-verify')
  @MfaFlow('enroll')
  async registerVerify(
    @Body() dto: PasskeyRegisterVerifyDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { id, recoveryCodes, firstMethod } = await this.mfaService.completePasskeyRegistration(
      user,
      dto.credential,
    );
    if (firstMethod) await this.setSessionCookie(user, response);
    return { id, recoveryCodes };
  }

  @Delete('totp')
  @HttpCode(204)
  @MfaFlow('manage')
  async removeTotp(@Body() dto: PasswordConfirmDto, @CurrentUser() user: AuthenticatedUser) {
    await this.mfaService.deleteTotp(user.id, dto.password);
  }

  @Delete('passkeys/:id')
  @HttpCode(204)
  @MfaFlow('manage')
  async removePasskey(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PasswordConfirmDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.mfaService.deletePasskey(user.id, id, dto.password);
  }

  @Post('recovery-codes/regenerate')
  @MfaFlow('manage')
  async regenerate(
    @Body() dto: PasswordConfirmDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const recoveryCodes = await this.mfaService.regenerateRecoveryCodes(user.id, dto.password);
    return { recoveryCodes };
  }

  // ------------------------------------------------------------ 로그인 검증

  @Post('verify/totp')
  @MfaFlow('pending')
  @Throttle(AUTH_THROTTLE)
  @UseGuards(LoginAttemptThrottlerGuard)
  async verifyTotp(
    @Body() dto: VerifyTotpDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    const session = await this.mfaService.verifyTotpCode(user, dto.code);
    response.cookie(AUTH_COOKIE_NAME, session.accessToken, authCookieOptions);
    return { user: session.user };
  }

  @Post('passkeys/auth-options')
  @MfaFlow('pending')
  @Throttle(AUTH_THROTTLE)
  @UseGuards(LoginAttemptThrottlerGuard)
  authOptions(@Body() _dto: MfaTokenDto, @CurrentUser() user: AuthenticatedUser) {
    return this.mfaService.beginPasskeyAuthentication(user);
  }

  // credential JSON도 register-verify와 같은 사유로 입력 검사를 생략한다.
  @SkipInputSecurity()
  @Post('verify/passkey')
  @MfaFlow('pending')
  @Throttle(AUTH_THROTTLE)
  @UseGuards(LoginAttemptThrottlerGuard)
  async verifyPasskey(
    @Body() dto: PasskeyAuthVerifyDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    const session = await this.mfaService.verifyPasskey(user, dto.credential);
    response.cookie(AUTH_COOKIE_NAME, session.accessToken, authCookieOptions);
    return { user: session.user };
  }

  @Post('verify/recovery')
  @MfaFlow('pending')
  @Throttle(AUTH_THROTTLE)
  @UseGuards(LoginAttemptThrottlerGuard)
  async verifyRecovery(
    @Body() dto: VerifyRecoveryDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    const session = await this.mfaService.verifyRecoveryCode(user, dto.code);
    response.cookie(AUTH_COOKIE_NAME, session.accessToken, authCookieOptions);
    return { user: session.user };
  }

  private async setSessionCookie(user: AuthenticatedUser, response: Response) {
    const { accessToken } = await this.mfaService.issueSession(user);
    response.cookie(AUTH_COOKIE_NAME, accessToken, authCookieOptions);
  }
}
