import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

// Per-client ceiling for every route; auth endpoints tighten it with AUTH_THROTTLE.
// REDIS_URL이 설정되면 모든 프로세스가 공유하는 Redis 저장소를 쓰고
// (AppModule의 createThrottlerStorage), 비워두면 프로세스 메모리 저장소라
// 인스턴스 수만큼 한도가 늘어나는 취약점이 남는다. https://docs.nestjs.com/security/rate-limiting#storages
export const DEFAULT_THROTTLE = { name: 'default', ttl: 60_000, limit: 300 };

// Credential-guessing surfaces (login, signup, contact verification codes).
export const AUTH_THROTTLE = { default: { ttl: 60_000, limit: 10 } };

// Toss webhook relay ceiling. One payment triggers only a few
// PAYMENT_STATUS_CHANGED calls (plus a handful of Toss redeliveries), so 30
// per minute per client blocks flood abuse of our Toss API relay while leaving
// legitimate traffic an order of magnitude of headroom. Without REDIS_URL the
// same per-process ceiling caveat as DEFAULT_THROTTLE applies.
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
    // 2차 인증 검증은 body에 이메일이 없으므로, 앞선 MfaAuthGuard가 채운 사용자 기준으로 계정 단위 제한을 건다.
    const userId = (req.user as { id?: unknown } | undefined)?.id;
    return Promise.resolve(
      typeof identifier === 'string' && identifier
        ? `login:${identifier.trim().toLowerCase()}`
        : typeof userId === 'string' && userId
          ? `login-user:${userId}`
          : `login-ip:${String(req.ip)}`,
    );
  }
}
