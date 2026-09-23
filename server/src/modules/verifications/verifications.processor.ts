import { Inject, Injectable, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
import { businesses, files, verifications } from '../../db/schema.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { FilesService } from '../files/files.service.js';
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
    private readonly filesService: FilesService,
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

    // 학교/비영리/협회 등은 사업자번호가 없어 NTS로 자동 확인할 수 없다 — 관리자 수동 심사
    // (`/admin/biz-review`)를 위해 pending으로 둔다.
    if (business && business.type && business.type !== '기업') {
      this.logger.log(`Verification ${verification.id} left for manual review`);
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
          ? await this.ocrClient.recognizeBusinessLicense(
              await this.filesService.getPrivateReadUrl(document.key),
            )
          : { raw: {} };
      const registrationNumber =
        ocrResult.registrationNumber?.replace(/\D/g, '') || business?.registrationNumber;
      const businessName = ocrResult.businessName ?? business?.name;
      // 가입 폼은 사업자번호를 받지 않으므로 OCR이 없거나 번호를 못 읽으면 자동 거절하지 않고
      // 관리자 수동 심사로 넘긴다.
      if (!registrationNumber) {
        await this.db
          .update(verifications)
          .set({ status: 'pending', updatedAt: new Date() })
          .where(eq(verifications.id, verification.id));
        this.logger.log(
          `Verification ${verification.id} has no registration number, manual review`,
        );
        return;
      }
      const ntsResult = await this.ntsClient.verifyBusinessRegistration(
        registrationNumber,
        businessName ?? '',
      );

      // OCR로 읽은 기관명/사업자번호로 비어 있는 기업 정보를 채운다.
      if (ntsResult.valid && business && (!business.name || !business.registrationNumber)) {
        await this.db
          .update(businesses)
          .set({
            name: business.name ?? businessName ?? null,
            registrationNumber: business.registrationNumber ?? registrationNumber,
          })
          .where(eq(businesses.id, business.id));
      }

      const status = ntsResult.valid ? 'verified' : 'rejected';
      await this.completeVerification(
        verification,
        business,
        status,
        { ...ocrResult.raw, nts: ntsResult.raw ?? null },
        ntsResult.valid ? null : (ntsResult.message ?? 'NTS verification failed'),
      );
    } catch (error) {
      // OCR/NTS providers throw only for infra-level failures (network, bad
      // config, non-OK responses) — actual "not a valid business" outcomes come
      // back as ntsResult.valid = false above, not an exception. Rethrowing
      // here leaves the SQS message unacknowledged so worker.ts's poll loop
      // retries it up to the queue's maxReceiveCount before it reaches the DLQ,
      // instead of a transient failure being recorded as a permanent rejection.
      this.logger.error(`Verification ${verification.id} processing failed, will retry`, error);
      // TODO: verification stays 'processing' if every retry fails and the
      // message lands in the DLQ; add alerting/manual recovery for that case.
      throw error;
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
      .set({
        status,
        ocrResult: ocrResult ?? null,
        rejectionReason: rejectionReason ?? null,
        updatedAt: new Date(),
      })
      .where(eq(verifications.id, verification.id));
    if (!business) return;
    await this.db
      .update(businesses)
      .set({ verificationStatus: status })
      .where(eq(businesses.id, business.id));
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
