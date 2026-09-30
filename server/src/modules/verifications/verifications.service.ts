import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
import { businesses, verifications } from '../../db/schema.js';
import { OutboxService } from '../../outbox/outbox.service.js';
import { FilesService } from '../files/files.service.js';
import type { SubmitVerificationDto } from './dto/submit-verification.dto.js';

// Outbox event type for a submitted verification's SQS job — shared with
// OutboxRelayService's `relay(eventType, queueUrl)` call in worker.ts.
export const VERIFICATION_SUBMITTED_EVENT = 'verification.submitted';

export interface VerificationJobMessage {
  verificationId: string;
}

export function verificationStatusPresentation(status: string) {
  if (status === 'verified') return { displayStatus: '승인', detailStatus: '승인' };
  if (status === 'rejected') return { displayStatus: '가승인', detailStatus: '실패' };
  return { displayStatus: '가승인', detailStatus: '인증 대기' };
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
      throw new NotFoundException('Business not found');
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

  async findById(id: string) {
    const [verification] = await this.db
      .select()
      .from(verifications)
      .where(eq(verifications.id, id))
      .limit(1);
    if (!verification) throw new NotFoundException('Verification not found');
    return { ...verification, ...verificationStatusPresentation(verification.status) };
  }
}
