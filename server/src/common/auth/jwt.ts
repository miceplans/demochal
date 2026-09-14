import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../../config/env.js';

export interface SessionTokenPayload {
  sub: string;
  role: string;
  iat: number;
  exp: number;
}

const b64url = (input: Buffer | string) =>
  Buffer.from(input).toString('base64url');

const sign = (data: string) =>
  createHmac('sha256', env.jwtSecret).update(data).digest('base64url');

function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

// Minimal HS256 JWT (node:crypto only). Keeps the session cookie format
// interoperable with standard JWT tooling while avoiding new dependencies.
export function signSessionToken(userId: string, role: string, ttlSeconds = 7 * 24 * 60 * 60): string {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const payload = b64url(
    JSON.stringify({ sub: userId, role, iat: now, exp: now + ttlSeconds } satisfies SessionTokenPayload),
  );
  const signature = sign(`${header}.${payload}`);
  return `${header}.${payload}.${signature}`;
}

export function verifySessionToken(token: string): SessionTokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;
  if (!header || !payload || !signature) return null;
  if (!safeEqual(sign(`${header}.${payload}`), signature)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as SessionTokenPayload;
    if (typeof parsed.sub !== 'string' || typeof parsed.exp !== 'number') return null;
    if (parsed.exp < Math.floor(Date.now() / 1000)) return null;
    return parsed;
  } catch {
    return null;
  }
}
