import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  Res,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
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
import { env } from '../../config/env.js';

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

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Not yet in openapi.yaml: email/password login has no signup path there
  // (production signup is social-only, still `planned`). Added so /auth/login
  // and /auth/me are actually exercisable in the meantime.
  @Post('register')
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) response: Response) {
    const { accessToken, user } = await this.authService.register(
      dto.email,
      dto.password,
      dto.name,
    );
    response.cookie(AUTH_COOKIE_NAME, accessToken, authCookieOptions);
    return { user };
  }

  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) response: Response) {
    const { accessToken, user } = await this.authService.login(dto.email, dto.password);
    response.cookie(AUTH_COOKIE_NAME, accessToken, authCookieOptions);
    return { user };
  }

  @Get('me')
  me(@Req() request: Request) {
    return this.authService.me(getAuthToken(request) ?? '');
  }

  @Get('google')
  googleLogin(@Res() response: Response) {
    this.assertGoogleConfigured();
    const nonce = randomBytes(32).toString('base64url');
    const state = `${nonce}.${this.signGoogleState(nonce)}`;
    // Login can start through the Next.js `/api` proxy while the callback is
    // served directly by the API. The root path works for either route.
    response.cookie(GOOGLE_STATE_COOKIE_NAME, nonce, GOOGLE_STATE_COOKIE_OPTIONS);

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

      const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: env.googleClientId,
          client_secret: env.googleClientSecret,
          redirect_uri: env.googleRedirectUri,
          grant_type: 'authorization_code',
        }),
      });
      const token = (await tokenResponse.json()) as { access_token?: string };
      if (!tokenResponse.ok || !token.access_token)
        throw new UnauthorizedException('Google token exchange failed');

      const userInfoResponse = await fetch(GOOGLE_USERINFO_URL, {
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
      response.redirect(
        user.onboardingSurvey ? this.frontendUrl('/') : this.frontendUrl('/onboarding/activity'),
      );
    } catch (err) {
      console.error('[auth] google_login_failed:', err);
      response.redirect(this.frontendUrl('/login?error=google_login_failed'));
    }
  }

  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) response: Response) {
    response.clearCookie(AUTH_COOKIE_NAME, authCookieClearOptions);
  }

  private assertGoogleConfigured() {
    if (!env.googleClientId || !env.googleClientSecret) {
      throw new ServiceUnavailableException('Google login is not configured');
    }
  }

  private signGoogleState(nonce: string) {
    return createHmac('sha256', env.jwtSecret).update(nonce).digest('base64url');
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

  private frontendUrl(path: string) {
    return new URL(path, env.frontendOrigins[0] ?? 'http://localhost:3000').toString();
  }
}
