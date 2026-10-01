import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, exists, inArray, or } from 'drizzle-orm';
import { DRIZZLE, type Database, type DbTx } from '../../db/drizzle.provider.js';
import { applications, businesses, challenges, files, orders } from '../../db/schema.js';
import { validateFormAnswers, type FormAnswer } from './form-answers.js';
import type { ApplyChallengeDto } from './dto/apply-challenge.dto.js';
import type { UpdateApplicationDto } from './dto/update-application.dto.js';

// Toss orderName 상한은 100자 — 그 이상의 챌린지 제목이 checkout 오픈을 막지 않게 잘라낸다.
function tossOrderName(title: string) {
  const trimmed = title.trim();
  if (!trimmed) return '챌린지 참가 신청';
  return trimmed.length > 100 ? `${trimmed.slice(0, 99)}…` : trimmed;
}

@Injectable()
export class ApplicationsService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async apply(dto: ApplyChallengeDto, userId: string) {
    return this.db.transaction(async (tx) => {
      const [challenge] = await tx
        .select({
          id: challenges.id,
          price: challenges.price,
          title: challenges.title,
          status: challenges.status,
          startDate: challenges.startDate,
          endDate: challenges.endDate,
          applicationForm: challenges.applicationForm,
        })
        .from(challenges)
        .where(eq(challenges.id, dto.challengeId))
        .limit(1);
      if (!challenge) throw new NotFoundException('Challenge not found');
      // Idempotent for (userId, challengeId): a retry after a lost response,
      // SDK rejection, or resubmission reuses the existing application and its
      // payable pending order instead of duplicating rows.
      const [existing] = await tx
        .select()
        .from(applications)
        .where(and(eq(applications.challengeId, challenge.id), eq(applications.userId, userId)))
        .limit(1);
      if (existing) {
        return {
          ...existing,
          order: await this.orderForApplication(tx, existing.id, userId, challenge),
        };
      }

      // 모집 기간·상태 검사는 신규 신청에만 강제한다 — 위 멱등 재사용(재결제 포함)은
      // 공고가 마감된 뒤에도 계속 동작해야 기존 신청자의 재시도가 좌초하지 않는다.
      const now = new Date();
      if (
        challenge.status !== 'published' ||
        challenge.startDate.getTime() > now.getTime() ||
        challenge.endDate.getTime() < now.getTime()
      ) {
        throw new BadRequestException('Challenge is not accepting applications');
      }

      const formAnswers = validateFormAnswers(challenge.applicationForm, dto.formAnswers);
      const fileIds = [
        ...new Set(
          formAnswers
            .filter((answer) => answer.type === 'file' && answer.value)
            .map((answer) => answer.value as string),
        ),
      ];
      if (fileIds.length) {
        const ownedFiles = await tx
          .select({ id: files.id })
          .from(files)
          .where(
            and(
              inArray(files.id, fileIds),
              eq(files.uploaderUserId, userId),
              eq(files.bucket, 'private'),
              eq(files.uploadStatus, 'ready'),
            ),
          );
        if (ownedFiles.length !== fileIds.length)
          throw new BadRequestException('A ready private file owned by the applicant is required');
      }

      const [application] = await tx
        .insert(applications)
        .values({
          challengeId: dto.challengeId,
          userId,
          role: dto.role,
          teammates: dto.teammates ?? [],
          formAnswers,
        })
        .returning();
      if (!application) throw new Error('Failed to create application');

      // Free challenges (price 0) have nothing to bill — see AdsService.create for
      // the paid-order counterpart of this same pending -> Toss webhook -> paid flow.
      if (challenge.price > 0) {
        return {
          ...application,
          order: await this.createPendingOrder(tx, application.id, userId, challenge),
        };
      }

      return { ...application, order: null };
    });
  }

  /**
   * 유료 신청의 결제 가능한 주문을 돌려준다. 아직 pending인 주문은 재사용하고,
   * 취소/만료 등 미결제 터미널 상태에 도달한 주문이면 재결제용 pending 주문을 새로 만든다.
   * 이미 paid면 null(결제할 것이 없음)이다.
   */
  private async orderForApplication(
    tx: DbTx,
    applicationId: string,
    userId: string,
    challenge: { id: string; price: number; title: string },
  ) {
    if (challenge.price <= 0) return null;
    const [latest] = await tx
      .select()
      .from(orders)
      .where(eq(orders.applicationId, applicationId))
      .orderBy(desc(orders.createdAt))
      .limit(1);
    if (latest?.status === 'paid') return null;
    if (latest?.status === 'pending') {
      return { id: latest.id, amount: latest.amount, name: tossOrderName(challenge.title) };
    }
    return this.createPendingOrder(tx, applicationId, userId, challenge);
  }

  private async createPendingOrder(
    tx: DbTx,
    applicationId: string,
    userId: string,
    challenge: { id: string; price: number; title: string },
  ) {
    const [order] = await tx
      .insert(orders)
      .values({
        applicationId,
        userId,
        amount: challenge.price,
        status: 'pending',
      })
      .returning();
    if (!order) throw new Error('Failed to create order');

    // The client settles this pending order via Toss and watches it through
    // GET /orders/{id} — orderId/amount feed the payment request, name the
    // Toss orderName display.
    return { id: order.id, amount: order.amount, name: tossOrderName(challenge.title) };
  }

  // 마이페이지 지원현황 테이블(챌린지/협회/결과)에 바로 그릴 수 있게
  // 챌린지 제목과 주최 기업명을 함께 남긴다.
  async listForUser(userId: string) {
    const rows = await this.db
      .select({
        application: applications,
        challengeTitle: challenges.title,
        businessName: businesses.name,
      })
      .from(applications)
      .innerJoin(challenges, eq(applications.challengeId, challenges.id))
      .innerJoin(businesses, eq(challenges.businessId, businesses.id))
      .where(eq(applications.userId, userId))
      .orderBy(desc(applications.createdAt));
    return rows.map(({ application, challengeTitle, businessName }) => ({
      ...application,
      challengeTitle,
      businessName,
    }));
  }

  async listForBusinessOwner(
    ownerUserId: string,
    filters: { challengeId?: string; status?: string },
  ) {
    const conditions = [eq(businesses.ownerUserId, ownerUserId)];
    if (filters.challengeId) conditions.push(eq(applications.challengeId, filters.challengeId));
    if (filters.status) conditions.push(eq(applications.status, filters.status));
    const rows = await this.db
      .select({ application: applications })
      .from(applications)
      .innerJoin(challenges, eq(applications.challengeId, challenges.id))
      .innerJoin(businesses, eq(challenges.businessId, businesses.id))
      .where(
        and(
          ...conditions,
          or(
            eq(challenges.price, 0),
            exists(
              this.db
                .select({ id: orders.id })
                .from(orders)
                .where(and(eq(orders.applicationId, applications.id), eq(orders.status, 'paid'))),
            ),
          ),
        ),
      )
      .orderBy(desc(applications.createdAt))
      .limit(100);
    return rows.map(({ application }) => application);
  }

  // Visible to the applicant themselves, or to the business that owns the challenge.
  async findById(id: string, userId: string) {
    const row = await this.findWithBusinessOwner(id);
    if (!row || (row.application.userId !== userId && row.businessOwnerId !== userId)) {
      throw new NotFoundException('Application not found');
    }
    if (row.application.userId !== userId && row.price > 0) {
      const [paid] = await this.db
        .select({ id: orders.id })
        .from(orders)
        .where(and(eq(orders.applicationId, id), eq(orders.status, 'paid')))
        .limit(1);
      if (!paid) throw new NotFoundException('Application not found');
    }
    return row.application;
  }

  async findAttachment(id: string, fileId: string, userId: string) {
    const application = await this.findById(id, userId);
    const answers = application.formAnswers as FormAnswer[];
    if (
      !Array.isArray(answers) ||
      !answers.some((answer) => answer.type === 'file' && answer.value === fileId)
    ) {
      throw new NotFoundException('File not found');
    }
    const [file] = await this.db
      .select()
      .from(files)
      .where(
        and(
          eq(files.id, fileId),
          eq(files.uploaderUserId, application.userId),
          eq(files.bucket, 'private'),
          eq(files.uploadStatus, 'ready'),
        ),
      )
      .limit(1);
    if (!file) throw new NotFoundException('File not found');
    return file;
  }

  // Only the business that owns the challenge may review (status/evaluation/memo).
  async update(id: string, dto: UpdateApplicationDto, userId: string) {
    const row = await this.findWithBusinessOwner(id);
    if (!row || row.businessOwnerId !== userId) {
      throw new NotFoundException('Application not found');
    }

    const [application] = await this.db
      .update(applications)
      .set({
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.evaluation !== undefined && { evaluation: dto.evaluation }),
        ...(dto.managerMemo !== undefined && { managerMemo: dto.managerMemo }),
      })
      .where(eq(applications.id, id))
      .returning();
    if (!application) throw new NotFoundException('Application not found');
    return application;
  }

  private async findWithBusinessOwner(id: string) {
    const [row] = await this.db
      .select({
        application: applications,
        businessOwnerId: businesses.ownerUserId,
        price: challenges.price,
      })
      .from(applications)
      .innerJoin(challenges, eq(applications.challengeId, challenges.id))
      .innerJoin(businesses, eq(challenges.businessId, businesses.id))
      .where(eq(applications.id, id))
      .limit(1);
    return row;
  }
}
