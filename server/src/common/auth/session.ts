import type { Request, Response } from 'express';
import { env } from '../../config/env.js';

export const SESSION_COOKIE_NAME = 'semochal_access';
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days, matches the spec.

export function extractSessionToken(req: Request): string | null {
  const authorization = req.headers.authorization;
  if (authorization?.startsWith('Bearer ')) {
    const token = authorization.slice('Bearer '.length).trim();
    if (token) return token;
  }
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;
  for (const pair of cookieHeader.split(';')) {
    const [name, ...rest] = pair.trim().split('=');
    if (name === SESSION_COOKIE_NAME) return decodeURIComponent(rest.join('='));
  }
  return null;
}

export function setSessionCookie(res: Response, token: string) {
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.nodeEnv === 'production',
    maxAge: SESSION_TTL_SECONDS * 1000,
    path: '/',
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE_NAME, { httpOnly: true, sameSite: 'lax', path: '/' });
}
