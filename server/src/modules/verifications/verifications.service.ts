import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
import { businesses, verifications } from '../../db/schema.js';
import { FilesService } from '../files/files.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { verificationStatusPresentation } from '../businesses/business-status.js';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard.js';
import type { SubmitVerificationDto } from './dto/submit-verification.dto.js';

@Injectable()
export class VerificationsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly filesService: FilesService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async submit(dto: SubmitVerificationDto, userId: string) {
    const [business] = await this.db
      .select({
        ownerUserId: businesses.ownerUserId,
        verificationStatus: businesses.verificationStatus,
      })
      .from(businesses)
      .where(eq(businesses.id, dto.businessId))
      .limit(1);
    if (!business || business.ownerUserId !== userId) {
      throw new NotFoundException('기업 정보를 찾을 수 없습니다.');
    }
    const document = await this.filesService.assertOwnedReadyPrivate(dto.documentFileId, userId);
    // 행 기록 전에 태그를 단다 — 태그 없이 저장된 서류는 S3 수명주기 상한을 벗어나기 때문이다.
    // 이후 DB 기록이 실패해도 태그된 객체는 수명주기 규칙으로 만료된다.
    await this.filesService.tagBusinessDocument(document.key);

    // 기관은 서류 심사 없이 전부 자동 승인한다(가입 시 verified와 같은 정책) — 외부 호출이
    // 없으므로 큐/워커 없이 제출 트랜잭션에서 바로 확정한다. 관리자가 차단(rejected)한 기관은
    // 서류 제출만으로 차단이 풀리지 않게 pending으로 남겨 관리자 심사(/admin/verifications)를 기다린다.
    // 실제 서류 심사(OCR 등)를 붙이면 외부 호출이 생기므로 outbox + 워커로 되돌린다(CLAUDE.md Outbox 패턴).
    const autoApprove = business.verificationStatus !== 'rejected';
    const verification = await this.db.transaction(async (tx) => {
      const [verification] = await tx
        .insert(verifications)
        .values({
          businessId: dto.businessId,
          documentFileId: dto.documentFileId,
          status: autoApprove ? 'verified' : 'pending',
        })
        .returning();
      if (!autoApprove) return verification!;

      await tx
        .update(businesses)
        .set({ verificationStatus: 'verified' })
        .where(eq(businesses.id, dto.businessId));
      // 상태 확정과 결과 알림을 같은 트랜잭션에 묶어 알림 없는 승인이 생기지 않게 한다.
      await this.notificationsService.create(
        userId,
        'verification.result',
        {
          verificationId: verification!.id,
          status: 'verified',
          displayStatus: '승인',
          detailStatus: '승인',
          message: '사업자 인증이 완료되어 승인되었습니다.',
        },
        tx,
      );
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
