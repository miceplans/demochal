import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { env } from '../../config/env.js';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
import { verifications } from '../../db/schema.js';
import { SqsService } from '../../queue/sqs.service.js';
import type { SubmitVerificationDto } from './dto/submit-verification.dto.js';

export interface VerificationJobMessage {
  verificationId: string;
}

@Injectable()
export class VerificationsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly sqsService: SqsService,
  ) {}

  async submit(dto: SubmitVerificationDto) {
    const [verification] = await this.db
      .insert(verifications)
      .values({
        businessId: dto.businessId,
        documentFileId: dto.documentFileId,
        status: 'pending',
      })
      .returning();

    // insert().returning() always yields the inserted row.
    const message: VerificationJobMessage = {
      verificationId: verification!.id,
    };
    // TODO: SQS_VERIFICATIONS_QUEUE_URL must be set once the queue exists in AWS.
    await this.sqsService.sendMessage(env.sqsVerificationsQueueUrl, message);

    return verification;
  }

  async findById(id: string) {
    const [verification] = await this.db
      .select()
      .from(verifications)
      .where(eq(verifications.id, id))
      .limit(1);
    if (!verification) throw new NotFoundException('Verification not found');
    return verification;
  }
}
