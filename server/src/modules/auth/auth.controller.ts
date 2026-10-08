import {
  Body,
  Controller,
  Get,
  HttpCode,
  Patch,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  ServiceUnavailableException,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import {
  AUTH_COOKIE_NAME,
  authCookieClearOptions,
  authCookieOptions,
  getAuthToken,
} from './auth.cookie.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import {
  ConfirmContactVerificationDto,
  RequestContactVerificationDto,
} from './dto/contact-verification.dto.js';
import { ContactVerificationsService } from './contact-verifications.service.js';
import { fetchJson } from '../../common/http/fetch-json.js';
import { SkipInputSecurity } from '../../common/security/skip-input-security.decorator.js';
import { env } from '../../config/env.js';
import { AUTH_THROTTLE, LoginAttemptThrottlerGuard } from '../../common/throttling/throttling.js';
import { Authenticated, Public } from './public.decorator.js';
import { CurrentUser } from './current-user.decorator.js';
import { JwtAuthGuard, type AuthenticatedUser } from './jwt-auth.guard.js';
import { WithdrawAccountDto } from './dto/withdraw-account.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { LOGIN_NEXT_COOKIE_NAME, sanitizeNextPath } from './next-path.js';

const GOOGLE_STATE_COOKIE_NAME = 'semochal_google_oauth_state';
const GOOGLE_STATE_COOKIE_OPTIONS = {
  httpOnly: true,
  maxAge: 10 * 60 * 1000,
  path: '/',
  sameSite: 'lax' as const,
  secure: env.nodeEnv === 'production',
};
const GOOGLE_AUTHORIZATION_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';

const NAVER_STATE_COOKIE_NAME = 'semochal_naver_oauth_state';
const NAVER_STATE_COOKIE_OPTIONS = {
  httpOnly: true,
  maxAge: 10 * 60 * 1000,
  path: '/',
  sameSite: 'lax' as const,
  secure: env.nodeEnv === 'production',
};
const NAVER_AUTHORIZATION_URL = 'https://nid.naver.com/oauth2.0/authorize';
const NAVER_TOKEN_URL = 'https://nid.naver.com/oauth2.0/token';
const NAVER_USERINFO_URL = 'https://openapi.naver.com/v1/nid/me';

// https://developers.kakao.com/docs/latest/ko/kakaologin/rest-api
const KAKAO_STATE_COOKIE_NAME = 'semochal_kakao_oauth_state';
const KAKAO_STATE_COOKIE_OPTIONS = {
  httpOnly: true,
  maxAge: 10 * 60 * 1000,
  path: '/',
  sameSite: 'lax' as const,
  secure: env.nodeEnv === 'production',
};
const KAKAO_AUTHORIZATION_URL = 'https://kauth.kakao.com/oauth/authorize';
const KAKAO_TOKEN_URL = 'https://kauth.kakao.com/oauth/token';
const KAKAO_USERINFO_URL = 'https://kapi.kakao.com/v2/user/me';

@Public()
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly contactVerifications: ContactVerificationsService,
  ) {}

  // Email/password signup; the biz signup (`/biz/login`) also sends username,
  // phone, contact verification ids and terms agreements.
  @Post('register')
  @Throttle(AUTH_THROTTLE)
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) response: Response) {
    const { accessToken, user } = await this.authService.register(dto);
    response.cookie(AUTH_COOKIE_NAME, accessToken, authCookieOptions);
    return { user };
  }

  @Post('contact-verifications')
  @Throttle(AUTH_THROTTLE)
  requestContactVerification(@Body() dto: RequestContactVerificationDto) {
    return this.contactVerifications.request(dto.channel, dto.target);
  }

  @Post('contact-verifications/:id/confirm')
  @HttpCode(200)
  @Throttle(AUTH_THROTTLE)
  confirmContactVerification(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmContactVerificationDto,
  ) {
    return this.contactVerifications.confirm(id, dto.code);
  }

  @Post('login')
  @Throttle(AUTH_THROTTLE)
  @UseGuards(LoginAttemptThrottlerGuard)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) response: Response) {
    const { accessToken, user } = await this.authService.login(
      dto.email ?? dto.username ?? '',
      dto.password,
    );
    response.cookie(AUTH_COOKIE_NAME, accessToken, authCookieOptions);
    return { user };
  }

  @Get('me')
  me(@Req() request: Request) {
    return this.authService.me(getAuthToken(request) ?? '');
  }

  @Get('google')
  googleLogin(@Query('next') next: string | undefined, @Res() response: Response) {
    this.assertGoogleConfigured();
    const nonce = randomBytes(32).toString('base64url');
    const state = `${nonce}.${this.signGoogleState(nonce)}`;
    // Login can start through the Next.js `/api` proxy while the callback is
    // served directly by the API. The root path works for either route.
    response.cookie(GOOGLE_STATE_COOKIE_NAME, nonce, GOOGLE_STATE_COOKIE_OPTIONS);
    this.rememberLoginNext(response, next);

    const authorizationUrl = new URL(GOOGLE_AUTHORIZATION_URL);
    authorizationUrl.search = new URLSearchParams({
      client_id: env.googleClientId,
      redirect_uri: env.googleRedirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      prompt: 'select_account',
    }).toString();
    response.redirect(authorizationUrl.toString());
  }

  // The callback's `code`, `state`, and `error` query values are opaque,
  // Google-issued tokens whose URL-safe alphabet can contain deny-list
  // sequences such as `--`. They are never used in SQL directly; security is
  // enforced below via the signed state/cookie comparison and the HTTPS token
  // exchange, so the generic input-security deny-list is opted out here.
  @SkipInputSecurity()
  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    response.clearCookie(GOOGLE_STATE_COOKIE_NAME, { path: '/' });
    try {
      this.assertGoogleConfigured();
      if (error || !code || !this.isValidGoogleState(state, request)) {
        throw new UnauthorizedException('Google login was cancelled or could not be verified');
      }

      const tokenResponse = await fetchJson(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: env.googleClientId,
          client_secret: env.googleClientSecret,
          redirect_uri: env.googleRedirectUri,
          grant_type: 'authorization_code',
        }).toString(),
      });
      const token = (await tokenResponse.json()) as { access_token?: string };
      if (!tokenResponse.ok || !token.access_token)
        throw new UnauthorizedException('Google token exchange failed');

      const userInfoResponse = await fetchJson(GOOGLE_USERINFO_URL, {
        headers: { authorization: `Bearer ${token.access_token}` },
      });
      const profile = (await userInfoResponse.json()) as {
        sub?: string;
        email?: string;
        email_verified?: boolean;
        name?: string;
      };
      if (!userInfoResponse.ok || !profile.sub || !profile.email || !profile.email_verified) {
        throw new UnauthorizedException('Google did not return a verified email address');
      }

      const { accessToken, user } = await this.authService.loginWithGoogle({
        subject: profile.sub,
        email: profile.email.toLowerCase(),
        name: profile.name ?? '',
      });
      response.cookie(AUTH_COOKIE_NAME, accessToken, authCookieOptions);
      response.redirect(this.postLoginUrl(user, request, response));
    } catch (err) {
      console.error('[auth] google_login_failed:', err);
      response.redirect(this.frontendUrl('/login?error=google_login_failed'));
    }
  }

  @Get('social/naver')
  naverLogin(@Query('next') next: string | undefined, @Res() response: Response) {
    this.assertNaverConfigured();
    const nonce = randomBytes(32).toString('base64url');
    const state = `${nonce}.${this.signNaverState(nonce)}`;
    response.cookie(NAVER_STATE_COOKIE_NAME, nonce, NAVER_STATE_COOKIE_OPTIONS);
    this.rememberLoginNext(response, next);

    const authorizationUrl = new URL(NAVER_AUTHORIZATION_URL);
    authorizationUrl.search = new URLSearchParams({
      response_type: 'code',
      client_id: env.naverClientId,
      redirect_uri: env.naverRedirectUri,
      state,
    }).toString();
    response.redirect(authorizationUrl.toString());
  }

  // Same opt-out rationale as googleCallback: `code`/`state` are opaque
  // provider tokens that may contain deny-list sequences such as `--`.
  @SkipInputSecurity()
  @Get('social/naver/callback')
  async naverCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    response.clearCookie(NAVER_STATE_COOKIE_NAME, { path: '/' });
    try {
      this.assertNaverConfigured();
      if (error || !code || !state || !this.isValidNaverState(state, request)) {
        throw new UnauthorizedException('Naver login was cancelled or could not be verified');
      }

      const tokenUrl = new URL(NAVER_TOKEN_URL);
      tokenUrl.search = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: env.naverClientId,
        client_secret: env.naverClientSecret,
        code,
        state,
      }).toString();
      const tokenResponse = await fetchJson(tokenUrl.toString());
      const token = (await tokenResponse.json()) as { access_token?: string };
      if (!tokenResponse.ok || !token.access_token)
        throw new UnauthorizedException('Naver token exchange failed');

      const userInfoResponse = await fetchJson(NAVER_USERINFO_URL, {
        headers: { authorization: `Bearer ${token.access_token}` },
      });
      const userInfo = (await userInfoResponse.json()) as {
        resultcode?: string;
        response?: { id?: string; email?: string; name?: string };
      };
      const profile = userInfo.response;
      if (!userInfoResponse.ok || userInfo.resultcode !== '00' || !profile?.id || !profile.email) {
        throw new UnauthorizedException('Naver did not return a verified email address');
      }

      const { accessToken, user } = await this.authService.loginWithNaver({
        subject: profile.id,
        email: profile.email.toLowerCase(),
        name: profile.name ?? '',
      });
      response.cookie(AUTH_COOKIE_NAME, accessToken, authCookieOptions);
      response.redirect(this.postLoginUrl(user, request, response));
    } catch (err) {
      console.error('[auth] naver_login_failed:', err);
      response.redirect(this.frontendUrl('/login?error=naver_login_failed'));
    }
  }

  @Get('social/kakao')
  kakaoLogin(@Query('next') next: string | undefined, @Res() response: Response) {
    this.assertKakaoConfigured();
    const nonce = randomBytes(32).toString('base64url');
    const state = `${nonce}.${this.signKakaoState(nonce)}`;
    response.cookie(KAKAO_STATE_COOKIE_NAME, nonce, KAKAO_STATE_COOKIE_OPTIONS);
    this.rememberLoginNext(response, next);

    // Consent items (nickname, account email) are configured in Kakao Developers,
    // so no `scope` is requested here.
    const authorizationUrl = new URL(KAKAO_AUTHORIZATION_URL);
    authorizationUrl.search = new URLSearchParams({
      response_type: 'code',
      client_id: env.kakaoClientId,
      redirect_uri: env.kakaoRedirectUri,
      state,
    }).toString();
    response.redirect(authorizationUrl.toString());
  }

  // Same opt-out rationale as googleCallback: `code`/`state` are opaque
  // provider tokens that may contain deny-list sequences such as `--`.
  @SkipInputSecurity()
  @Get('social/kakao/callback')
  async kakaoCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    response.clearCookie(KAKAO_STATE_COOKIE_NAME, { path: '/' });
    try {
      this.assertKakaoConfigured();
      if (error || !code || !this.isValidKakaoState(state, request)) {
        throw new UnauthorizedException('Kakao login was cancelled or could not be verified');
      }

      const tokenBody = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: env.kakaoClientId,
        redirect_uri: env.kakaoRedirectUri,
        code,
      });
      if (env.kakaoClientSecret) tokenBody.set('client_secret', env.kakaoClientSecret);
      const tokenResponse = await fetchJson(KAKAO_TOKEN_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded;charset=utf-8' },
        body: tokenBody.toString(),
      });
      const token = (await tokenResponse.json()) as { access_token?: string };
      if (!tokenResponse.ok || !token.access_token)
        throw new UnauthorizedException('Kakao token exchange failed');

      const userInfoResponse = await fetchJson(KAKAO_USERINFO_URL, {
        headers: { authorization: `Bearer ${token.access_token}` },
      });
      const profile = (await userInfoResponse.json()) as {
        id?: number | string;
        kakao_account?: {
          email?: string;
          is_email_valid?: boolean;
          is_email_verified?: boolean;
          profile?: { nickname?: string };
        };
      };
      const account = profile.kakao_account;
      // Email is only returned when the user consented to it; a missing, invalid,
      // or unverified email must not be linked to an existing account.
      if (
        !userInfoResponse.ok ||
        profile.id === undefined ||
        !account?.email ||
        !account.is_email_valid ||
        !account.is_email_verified
      ) {
        throw new UnauthorizedException('Kakao did not return a verified email address');
      }

      const { accessToken, user } = await this.authService.loginWithKakao({
        subject: String(profile.id),
        email: account.email.toLowerCase(),
        name: account.profile?.nickname ?? '',
      });
      response.cookie(AUTH_COOKIE_NAME, accessToken, authCookieOptions);
      response.redirect(this.postLoginUrl(user, request, response));
    } catch (err) {
      console.error('[auth] kakao_login_failed:', err);
      response.redirect(this.frontendUrl('/login?error=kakao_login_failed'));
    }
  }

  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) response: Response) {
    response.clearCookie(AUTH_COOKIE_NAME, authCookieClearOptions);
  }

  @Post('withdraw')
  @HttpCode(204)
  @Authenticated()
  @UseGuards(JwtAuthGuard)
  async withdraw(
    @Body() dto: WithdrawAccountDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.authService.withdraw(user.id, dto);
    response.clearCookie(AUTH_COOKIE_NAME, authCookieClearOptions);
  }

  @Patch('password')
  @HttpCode(200)
  @Authenticated()
  @UseGuards(JwtAuthGuard)
  async changePassword(@Body() dto: ChangePasswordDto, @CurrentUser() user: AuthenticatedUser) {
    await this.authService.changePassword(user.id, dto);
    return { changed: true };
  }

  private assertGoogleConfigured() {
    if (!env.googleClientId || !env.googleClientSecret) {
      throw new ServiceUnavailableException('구글 로그인이 현재 제공되지 않습니다.');
    }
  }

  private signGoogleState(nonce: string) {
    return createHmac('sha256', env.oauthStateSecret).update(nonce).digest('base64url');
  }

  private isValidGoogleState(state: string | undefined, request: Request) {
    const cookie = request.headers.cookie
      ?.split(';')
      .map((value) => value.trim())
      .find((value) => value.startsWith(`${GOOGLE_STATE_COOKIE_NAME}=`))
      ?.slice(GOOGLE_STATE_COOKIE_NAME.length + 1);
    if (!state || !cookie) return false;
    const [nonce, signature] = state.split('.');
    if (!nonce || !signature || nonce !== cookie) return false;
    const expected = this.signGoogleState(nonce);
    return (
      signature.length === expected.length &&
      timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    );
  }

  private assertNaverConfigured() {
    if (!env.naverClientId || !env.naverClientSecret) {
      throw new ServiceUnavailableException('네이버 로그인이 현재 제공되지 않습니다.');
    }
  }

  private signNaverState(nonce: string) {
    return createHmac('sha256', env.oauthStateSecret).update(nonce).digest('base64url');
  }

  private isValidNaverState(state: string | undefined, request: Request) {
    const cookie = request.headers.cookie
      ?.split(';')
      .map((value) => value.trim())
      .find((value) => value.startsWith(`${NAVER_STATE_COOKIE_NAME}=`))
      ?.slice(NAVER_STATE_COOKIE_NAME.length + 1);
    if (!state || !cookie) return false;
    const [nonce, signature] = state.split('.');
    if (!nonce || !signature || nonce !== cookie) return false;
    const expected = this.signNaverState(nonce);
    return (
      signature.length === expected.length &&
      timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    );
  }

  private assertKakaoConfigured() {
    if (!env.kakaoClientId) {
      throw new ServiceUnavailableException('카카오 로그인이 현재 제공되지 않습니다.');
    }
  }

  private signKakaoState(nonce: string) {
    return createHmac('sha256', env.oauthStateSecret).update(nonce).digest('base64url');
  }

  private isValidKakaoState(state: string | undefined, request: Request) {
    const cookie = request.headers.cookie
      ?.split(';')
      .map((value) => value.trim())
      .find((value) => value.startsWith(`${KAKAO_STATE_COOKIE_NAME}=`))
      ?.slice(KAKAO_STATE_COOKIE_NAME.length + 1);
    if (!state || !cookie) return false;
    const [nonce, signature] = state.split('.');
    if (!nonce || !signature || nonce !== cookie) return false;
    const expected = this.signKakaoState(nonce);
    return (
      signature.length === expected.length &&
      timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    );
  }

  private rememberLoginNext(response: Response, next: string | undefined) {
    const safeNext = sanitizeNextPath(next);
    if (safeNext) {
      response.cookie(LOGIN_NEXT_COOKIE_NAME, safeNext, GOOGLE_STATE_COOKIE_OPTIONS);
    } else {
      response.clearCookie(LOGIN_NEXT_COOKIE_NAME, { path: '/' });
    }
  }

  /** Only a null survey is incomplete; otherwise return to the page from `?next=`. */
  private postLoginUrl(user: { onboardingSurvey?: unknown }, request: Request, response: Response) {
    const raw = request.headers.cookie
      ?.split(';')
      .map((value) => value.trim())
      .find((value) => value.startsWith(`${LOGIN_NEXT_COOKIE_NAME}=`))
      ?.slice(LOGIN_NEXT_COOKIE_NAME.length + 1);
    response.clearCookie(LOGIN_NEXT_COOKIE_NAME, { path: '/' });
    if (user.onboardingSurvey === null) return this.frontendUrl('/onboarding/activity');
    let next: string | null = null;
    try {
      next = sanitizeNextPath(raw && decodeURIComponent(raw));
    } catch {
      next = null;
    }
    return this.frontendUrl(next ?? '/');
  }

  private frontendUrl(path: string) {
    return new URL(path, env.frontendOrigins[0] ?? 'http://localhost:3000').toString();
  }
}
