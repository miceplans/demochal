import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { env } from '../../config/env.js';

export interface GoogleTokenResponse {
  access_token: string;
}

export interface GoogleUserInfo {
  id: string;
  email: string;
  name: string;
}

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

@Injectable()
export class GoogleOAuthClient {
  assertConfigured() {
    if (!env.googleClientId || !env.googleClientSecret) {
      throw new InternalServerErrorException('Google OAuth is not configured');
    }
  }

  redirectUri() {
    return `${env.apiPublicUrl}/auth/google/callback`;
  }

  authorizationUrl(state?: string) {
    this.assertConfigured();
    const query = new URLSearchParams({
      client_id: env.googleClientId,
      redirect_uri: this.redirectUri(),
      response_type: 'code',
      scope: 'openid email profile',
      prompt: 'select_account',
    });
    if (state) query.set('state', state);
    return `${GOOGLE_AUTH_URL}?${query.toString()}`;
  }

  async exchangeCode(code: string, redirectUri?: string): Promise<GoogleUserInfo> {
    this.assertConfigured();
    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.googleClientId,
        client_secret: env.googleClientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri ?? this.redirectUri(),
      }).toString(),
    });
    if (!tokenResponse.ok) {
      throw new Error(`Google token exchange failed: ${tokenResponse.status}`);
    }
    const { access_token } = (await tokenResponse.json()) as GoogleTokenResponse;

    const profileResponse = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (!profileResponse.ok) {
      throw new Error(`Google profile fetch failed: ${profileResponse.status}`);
    }
    return (await profileResponse.json()) as GoogleUserInfo;
  }
}
