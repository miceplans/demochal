import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

// Per-client ceiling for every route; auth endpoints tighten it with AUTH_THROTTLE.
// TODO: 기본 저장소는 태스크 메모리라 ECS 태스크 수만큼 한도가 늘어난다 — 스케일아웃 시
// Redis 등 공유 저장소로 교체한다. https://docs.nestjs.com/security/rate-limiting#storages
export const DEFAULT_THROTTLE = { name: 'default', ttl: 60_000, limit: 300 };

// Credential-guessing surfaces (login, signup, contact verification codes).
export const AUTH_THROTTLE = { default: { ttl: 60_000, limit: 10 } };

// Toss webhook relay ceiling. One payment triggers only a few
// PAYMENT_STATUS_CHANGED calls (plus a handful of Toss redeliveries), so 30
// per minute per client blocks flood abuse of our Toss API relay while leaving
// legitimate traffic an order of magnitude of headroom. Same in-memory-store
// caveat as DEFAULT_THROTTLE applies (ceiling is per ECS task until Redis).
export const TOSS_WEBHOOK_THROTTLE = { default: { ttl: 60_000, limit: 30 } };

/**
 * Tracks login attempts per target account instead of per client, so spreading a
 * password-guessing run across many IPs (or behind a shared proxy IP) still hits
 * the limit. Applied on top of the global per-IP ThrottlerGuard.
 */
@Injectable()
export class LoginAttemptThrottlerGuard extends ThrottlerGuard {
  protected override getTracker(req: Record<string, any>): Promise<string> {
    const body = (req.body ?? {}) as { email?: unknown; username?: unknown };
    const identifier = body.email ?? body.username;
    return Promise.resolve(
      typeof identifier === 'string' && identifier
        ? `login:${identifier.trim().toLowerCase()}`
        : `login-ip:${String(req.ip)}`,
    );
  }
}
