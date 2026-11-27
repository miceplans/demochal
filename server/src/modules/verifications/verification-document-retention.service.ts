import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, inArray, lt, ne, or } from 'drizzle-orm';
import { env } from '../../config/env.js';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
import { files, verifications } from '../../db/schema.js';
import { FilesService } from '../files/files.service.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const BATCH_SIZE = 100;

export type RetentionPolicy = { retentionDays: number; maxRetentionDays: number };

/**
 * 사업자 서류(사업자등록증) 보관 기한 집행. 워커가 주기적으로 `purgeExpired()`를 호출한다.
 *
 * - 인증이 결정(verified/rejected)된 지 `retentionDays`가 지난 서류
 * - 결정 여부와 무관하게 제출된 지 `maxRetentionDays`가 지난 서류
 * 를 private 버킷에서 지우고 files 행을 'deleted'로, verifications.ocrResult를 null로 만든다.
 * 인증은 서류 심사 없이 자동 승인되고 관리자 화면도 서류를 열지 않으므로 결정 뒤에는
 * 서류를 계속 둘 이유가 없다.
 *
 * 태그(`BUSINESS_DOCUMENT_TAG`)가 달린 새 서류는 private 버킷 수명주기 규칙이 같은 MAX 기한으로
 * 한 번 더 막는다. 태그 도입 전 서류는 이 스캔만이 지운다. 다중 워커에서도 안전하다
 * (S3 삭제·행 갱신 모두 멱등).
 *
 * TODO: 인증 제출 없이 버려진 업로드(사업자 서류인지 알 수 없는 private 파일)는 대상이 아니다 —
 * 파일 용도(purpose)를 기록하게 되면 함께 정리한다.
 * https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lifecycle-mgmt.html
 */
@Injectable()
export class VerificationDocumentRetentionService {
  private readonly logger = new Logger(VerificationDocumentRetentionService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly filesService: FilesService,
  ) {}

  async purgeExpired(
    now = new Date(),
    policy: RetentionPolicy = {
      retentionDays: env.verificationDocumentRetentionDays,
      maxRetentionDays: env.verificationDocumentMaxRetentionDays,
    },
  ): Promise<{ deleted: number; failed: number }> {
    const decidedBefore = new Date(now.getTime() - policy.retentionDays * DAY_MS);
    const submittedBefore = new Date(now.getTime() - policy.maxRetentionDays * DAY_MS);

    let deleted = 0;
    let failed = 0;
    const failedIds = new Set<string>();
    // Drains the backlog in batches; a file that failed is skipped for the rest of
    // this pass (the next hourly pass retries it) so a persistent failure cannot spin.
    for (;;) {
      const rows = await this.db
        .selectDistinct({ id: files.id, key: files.key })
        .from(verifications)
        .innerJoin(files, eq(files.id, verifications.documentFileId))
        .where(
          and(
            eq(files.bucket, 'private'),
            ne(files.uploadStatus, 'deleted'),
            or(
              and(
                inArray(verifications.status, ['verified', 'rejected']),
                lt(verifications.updatedAt, decidedBefore),
              ),
              lt(verifications.createdAt, submittedBefore),
            ),
          ),
        )
        .limit(BATCH_SIZE + failedIds.size);

      const batch = rows.filter((row) => !failedIds.has(row.id));
      if (batch.length === 0) break;

      for (const file of batch) {
        try {
          await this.filesService.deletePrivateFile(file);
          await this.db
            .update(verifications)
            .set({ ocrResult: null })
            .where(eq(verifications.documentFileId, file.id));
          deleted += 1;
        } catch (error) {
          failedIds.add(file.id);
          failed += 1;
          // 파일 id와 에러 이름만 — 서류 키·OCR 결과·사업자번호는 로그에 남기지 않는다.
          const name = error instanceof Error ? error.name : 'UnknownError';
          this.logger.warn(`Failed to delete verification document ${file.id} (${name})`);
        }
      }
      // The query over-fetches by the failed count, so a short batch means the backlog is drained.
      if (batch.length < BATCH_SIZE) break;
    }
    return { deleted, failed };
  }
}
