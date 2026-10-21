import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
import { businesses, verifications } from '../../db/schema.js';
import { OutboxService } from '../../outbox/outbox.service.js';
import { FilesService } from '../files/files.service.js';
import { verificationStatusPresentation } from '../businesses/business-status.js';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard.js';
import type { SubmitVerificationDto } from './dto/submit-verification.dto.js';

// Outbox event type for a submitted verification's SQS job — shared with
// OutboxRelayService's `relay(eventType, queueUrl)` call in worker.ts.
export const VERIFICATION_SUBMITTED_EVENT = 'verification.submitted';

export interface VerificationJobMessage {
  verificationId: string;
}

@Injectable()
export class VerificationsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly outboxService: OutboxService,
    private readonly filesService: FilesService,
  ) {}

  async submit(dto: SubmitVerificationDto, userId: string) {
    const [business] = await this.db
      .select({ ownerUserId: businesses.ownerUserId })
      .from(businesses)
      .where(eq(businesses.id, dto.businessId))
      .limit(1);
    if (!business || business.ownerUserId !== userId) {
      throw new NotFoundException('기업 정보를 찾을 수 없습니다.');
    }
    await this.filesService.assertOwnedReadyPrivate(dto.documentFileId, userId);

    const verification = await this.db.transaction(async (tx) => {
      const [verification] = await tx
        .insert(verifications)
        .values({
          businessId: dto.businessId,
          documentFileId: dto.documentFileId,
          status: 'pending',
        })
        .returning();

      // insert().returning() always yields the inserted row.
      const message: VerificationJobMessage = { verificationId: verification!.id };
      // Enqueued in the same transaction as the row above, so a crash right
      // after commit can never lose the SQS job — OutboxRelayService (driven
      // from worker.ts) sends it once SQS_VERIFICATIONS_QUEUE_URL is set.
      await this.outboxService.enqueue(tx, VERIFICATION_SUBMITTED_EVENT, message);

      return verification!;
    });

    return { ...verification, ...verificationStatusPresentation(verification.status) };
  }

  // OCR 결과 등 민감한 인증 데이터가 담기므로 해당 기업의 소유자나 관리자만 볼 수 있다 —
  // 존재 여부 자첼 숨기려 submit과 같은 404를 쓴다.
  async findById(id: string, user: AuthenticatedUser) {
    const [row] = await this.db
      .select({ verification: verifications, ownerUserId: businesses.ownerUserId })
      .from(verifications)
      .innerJoin(businesses, eq(verifications.businessId, businesses.id))
      .where(eq(verifications.id, id))
      .limit(1);
    if (!row || (row.ownerUserId !== user.id && user.role !== 'admin')) {
      throw new NotFoundException('인증 요청을 찾을 수 없습니다.');
    }
    return {
      ...row.verification,
      ...verificationStatusPresentation(row.verification.status),
    };
  }
}
