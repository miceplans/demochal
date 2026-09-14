import { Inject, Injectable, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
import { businesses, files, verifications } from '../../db/schema.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { ClovaOcrClient } from './clients/clova-ocr.client.js';
import { NtsClient } from './clients/nts.client.js';
import type { VerificationJobMessage } from './verifications.service.js';
import { AdminSettingsService } from '../admin/admin-settings.service.js';

// Consumed by worker.ts's SQS poll loop — never invoked over HTTP.
@Injectable()
export class VerificationsProcessorService {
  private readonly logger = new Logger(VerificationsProcessorService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly ocrClient: ClovaOcrClient,
    private readonly ntsClient: NtsClient,
    private readonly notificationsService: NotificationsService,
    private readonly adminSettingsService: AdminSettingsService,
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

    const [business] = await this.db
      .select()
      .from(businesses)
      .where(eq(businesses.id, verification.businessId))
      .limit(1);
    const [document] = await this.db
      .select()
      .from(files)
      .where(eq(files.id, verification.documentFileId))
      .limit(1);

    if (await this.adminSettingsService.isEnabled('bizAutoApprove')) {
      await this.completeVerification(verification, business, 'verified');
      return;
    }

    await this.db
      .update(verifications)
      .set({ status: 'processing', updatedAt: new Date() })
      .where(eq(verifications.id, verification.id));

    try {
      // NTS can verify from the registration number. OCR enriches the request
      // when it is configured, but a missing OCR integration must not reject a
      // legitimate verification outright.
      const ocrResult =
        document && this.ocrClient.isConfigured()
          ? await this.ocrClient.recognizeBusinessLicense(document.key)
          : { raw: {} };
      const ntsResult = await this.ntsClient.verifyBusinessRegistration(
        ocrResult.registrationNumber ?? business?.registrationNumber ?? '',
        ocrResult.businessName ?? business?.name ?? '',
      );

      const status = ntsResult.valid ? 'verified' : 'rejected';
      await this.completeVerification(
        verification,
        business,
        status,
        { ...ocrResult.raw, nts: ntsResult.raw ?? null },
        ntsResult.valid ? null : ntsResult.message ?? 'NTS verification failed',
      );
    } catch (error) {
      this.logger.error(`Verification ${verification.id} processing failed`, error);
      await this.db
        .update(verifications)
        .set({
          status: 'rejected',
          rejectionReason: error instanceof Error ? error.message : 'Unknown error',
          updatedAt: new Date(),
        })
        .where(eq(verifications.id, verification.id));
    }
  }

  private async completeVerification(
    verification: typeof verifications.$inferSelect,
    business: typeof businesses.$inferSelect | undefined,
    status: 'verified' | 'rejected',
    ocrResult?: unknown,
    rejectionReason?: string | null,
  ) {
    await this.db
      .update(verifications)
      .set({ status, ocrResult: ocrResult ?? null, rejectionReason: rejectionReason ?? null, updatedAt: new Date() })
      .where(eq(verifications.id, verification.id));
    if (!business) return;
    await this.db.update(businesses).set({ verificationStatus: status }).where(eq(businesses.id, business.id));
    const approved = status === 'verified';
    await this.notificationsService.create(business.ownerUserId, 'verification.result', {
      verificationId: verification.id,
      status,
      displayStatus: approved ? '승인' : '가승인',
      detailStatus: approved ? '승인' : '실패',
      message: approved
        ? '사업자 인증이 완료되어 승인되었습니다.'
        : '사업자 인증에 실패했습니다. 상세 상태를 확인해 주세요.',
    });
  }
}
