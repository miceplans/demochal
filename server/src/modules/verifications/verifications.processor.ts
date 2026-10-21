import { Inject, Injectable, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
import { businesses, verifications } from '../../db/schema.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import type { VerificationJobMessage } from './verifications.service.js';

// Consumed by worker.ts's SQS poll loop — never invoked over HTTP.
@Injectable()
export class VerificationsProcessorService {
  private readonly logger = new Logger(VerificationsProcessorService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly notificationsService: NotificationsService,
  ) {}

  async process(message: VerificationJobMessage): Promise<void> {
    const [verification] = await this.db
      .select()
      .from(verifications)
      .where(eq(verifications.id, message.verificationId))
      .limit(1);
    if (!verification) {
      this.logger.warn(`Verification ${message.verificationId} not found, skipping`);
      return;
    }
    // SQS 재전달이나 관리자 수동 심사로 이미 확정된 요청은 다시 처리하지 않는다 —
    // 그러지 않으면 관리자의 승인/거부 결정을 워커가 덮어쓰고 알림이 중복 발송된다.
    if (verification.status === 'verified' || verification.status === 'rejected') {
      this.logger.log(`Verification ${verification.id} already ${verification.status}, skipping`);
      return;
    }

    const [business] = await this.db
      .select()
      .from(businesses)
      .where(eq(businesses.id, verification.businessId))
      .limit(1);

    // 기관은 서류 심사 없이 전부 자동 승인한다(가입 시 verified와 같은 정책).
    await this.completeVerification(verification, business, 'verified');
  }

  private async completeVerification(
    verification: typeof verifications.$inferSelect,
    business: typeof businesses.$inferSelect | undefined,
    status: 'verified' | 'rejected',
    ocrResult?: unknown,
    rejectionReason?: string | null,
  ) {
    // The verification/business status write and its result notification commit
    // together — a failure after the status flip would otherwise make the SQS
    // retry (or an admin) see a decided verification with no notification.
    await this.db.transaction(async (tx) => {
      await tx
        .update(verifications)
        .set({
          status,
          ocrResult: ocrResult ?? null,
          rejectionReason: rejectionReason ?? null,
          updatedAt: new Date(),
        })
        .where(eq(verifications.id, verification.id));
      if (!business) return;
      await tx
        .update(businesses)
        .set({ verificationStatus: status })
        .where(eq(businesses.id, business.id));
      await this.notificationsService.create(
        business.ownerUserId,
        'verification.result',
        this.resultPayload(verification.id, status),
        tx,
      );
    });
  }

  private resultPayload(verificationId: string, status: 'verified' | 'rejected') {
    const approved = status === 'verified';
    return {
      verificationId,
      status,
      displayStatus: approved ? '승인' : '가승인',
      detailStatus: approved ? '승인' : '실패',
      message: approved
        ? '사업자 인증이 완료되어 승인되었습니다.'
        : '사업자 인증에 실패했습니다. 상세 상태를 확인해 주세요.',
    };
  }
}
