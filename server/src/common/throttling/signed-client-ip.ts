import { createHmac, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import type { RequestHandler } from 'express';

const MAX_AGE_MS = 30_000;
const CLIENT_IP_HEADER = 'x-semochal-client-ip';
const TIMESTAMP_HEADER = 'x-semochal-client-ip-time';
const SIGNATURE_HEADER = 'x-semochal-client-ip-signature';

export function verifiedClientIp(
  headers: Record<string, string | string[] | undefined>,
  secret: string | undefined,
  now = Date.now(),
): string | undefined {
  if (!secret) return undefined;
  const ip = headers[CLIENT_IP_HEADER];
  const timestamp = headers[TIMESTAMP_HEADER];
  const signature = headers[SIGNATURE_HEADER];
  if (
    typeof ip !== 'string' ||
    isIP(ip) === 0 ||
    typeof timestamp !== 'string' ||
    !/^\d{13}$/.test(timestamp) ||
    Math.abs(now - Number(timestamp)) > MAX_AGE_MS ||
    typeof signature !== 'string' ||
    !/^[0-9a-f]{64}$/.test(signature)
  ) {
    return undefined;
  }
  const expected = createHmac('sha256', secret).update(`${timestamp}.${ip}`).digest();
  const received = Buffer.from(signature, 'hex');
  return timingSafeEqual(expected, received) ? ip : undefined;
}

export function signedClientIpMiddleware(secret: string | undefined): RequestHandler {
  return (req, _res, next) => {
    const ip = verifiedClientIp(req.headers, secret);
    if (ip) {
      // Express computes req.ip from X-Forwarded-For by default. Replace it only
      // after verifying the header signed by the frontend Proxy.
      Object.defineProperty(req, 'ip', { value: ip, configurable: true });
    }
    next();
  };
}
