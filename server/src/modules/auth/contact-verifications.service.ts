import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { env } from '../../config/env.js';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
import { contactVerifications } from '../../db/schema.js';
import { OutboxService } from '../../outbox/outbox.service.js';

export type ContactChannel = 'email' | 'phone';

// Outbox event for delivering a verification code (email/SMS).
export const CONTACT_VERIFICATION_REQUESTED_EVENT = 'contact_verification.requested';

export interface ContactVerificationMessage {
  verificationId: string;
  channel: ContactChannel;
  target: string;
  code: string;
}

const CODE_TTL_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;
// A confirmed code must be used for signup within this window.
const VERIFIED_USABLE_MS = 30 * 60 * 1000;

const hashCode = (code: string) => createHash('sha256').update(code).digest('hex');

export function normalizeContact(channel: ContactChannel, target: string): string {
  if (channel === 'email') return target.trim().toLowerCase();
  const digits = target.replace(/\D/g, '');
  if (!/^01\d{8,9}$/.test(digits)) throw new BadRequestException('휴대폰 번호를 확인해주세요.');
  return digits;
}

@Injectable()
export class ContactVerificationsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly outboxService: OutboxService,
  ) {}

  async request(channel: ContactChannel, rawTarget: string) {
    // TODO: 이메일(SES)/SMS 발송 relay가 아직 없다 — CONTACT_VERIFICATION_REQUESTED_EVENT를
    // 소비하는 발송기를 worker에 붙이기 전까지 production에서는 발송 불가로 응답한다.
    // https://docs.aws.amazon.com/ses/latest/dg/send-email-api.html
    if (env.nodeEnv === 'production') {
      throw new ServiceUnavailableException('인증번호 발송이 아직 준비되지 않았어요.');
    }

    const target = normalizeContact(channel, rawTarget);
    const [recent] = await this.db
      .select({ id: contactVerifications.id })
      .from(contactVerifications)
      .where(
        and(
          eq(contactVerifications.channel, channel),
          eq(contactVerifications.target, target),
          gt(contactVerifications.createdAt, new Date(Date.now() - RESEND_COOLDOWN_MS)),
        ),
      )
      .limit(1);
    if (recent) {
      throw new HttpException('잠시 후 다시 요청해주세요.', HttpStatus.TOO_MANY_REQUESTS);
    }

    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const expiresAt = new Date(Date.now() + CODE_TTL_MS);
    const verification = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(contactVerifications)
        .values({ channel, target, codeHash: hashCode(code), expiresAt })
        .returning();
      const message: ContactVerificationMessage = {
        verificationId: row!.id,
        channel,
        target,
        code,
      };
      await this.outboxService.enqueue(tx, CONTACT_VERIFICATION_REQUESTED_EVENT, message);
      return row!;
    });

    // Delivery is not wired yet, so non-production responses carry the code
    // to keep the signup flow testable locally.
    return { id: verification.id, expiresAt, devCode: code };
  }

  async confirm(id: string, code: string) {
    const [row] = await this.db
      .select()
      .from(contactVerifications)
      .where(eq(contactVerifications.id, id))
      .limit(1);
    if (!row) throw new NotFoundException('인증 요청을 찾을 수 없어요.');
    if (row.verifiedAt) return { id: row.id, verified: true };
    if (row.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('인증번호가 만료됐어요. 다시 요청해주세요.');
    }
    if (row.attempts >= MAX_ATTEMPTS) {
      throw new BadRequestException('시도 횟수를 초과했어요. 다시 요청해주세요.');
    }

    const matches = timingSafeEqual(Buffer.from(hashCode(code)), Buffer.from(row.codeHash));
    if (!matches) {
      await this.db
        .update(contactVerifications)
        .set({ attempts: row.attempts + 1 })
        .where(eq(contactVerifications.id, id));
      throw new BadRequestException('인증번호가 일치하지 않아요.');
    }

    await this.db
      .update(contactVerifications)
      .set({ verifiedAt: new Date() })
      .where(eq(contactVerifications.id, id));
    return { id: row.id, verified: true };
  }

  /** Marks a confirmed verification as used by a signup; returns its verified time. */
  async consume(tx: Database, id: string, channel: ContactChannel, rawTarget: string) {
    const target = normalizeContact(channel, rawTarget);
    const [row] = await tx
      .update(contactVerifications)
      .set({ consumedAt: new Date() })
      .where(
        and(
          eq(contactVerifications.id, id),
          eq(contactVerifications.channel, channel),
          eq(contactVerifications.target, target),
          isNull(contactVerifications.consumedAt),
          gt(contactVerifications.verifiedAt, new Date(Date.now() - VERIFIED_USABLE_MS)),
        ),
      )
      .returning();
    if (!row?.verifiedAt) {
      throw new BadRequestException(
        channel === 'email'
          ? '이메일 인증을 다시 진행해주세요.'
          : '휴대폰 인증을 다시 진행해주세요.',
      );
    }
    return row.verifiedAt;
  }
}
