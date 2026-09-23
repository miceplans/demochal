import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { DRIZZLE, type Database, type DbTx } from '../../db/drizzle.provider.js';
import { applications, businesses, challenges, orders } from '../../db/schema.js';
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
        .select({ id: challenges.id, price: challenges.price, title: challenges.title })
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

      const [application] = await tx
        .insert(applications)
        .values({
          challengeId: dto.challengeId,
          userId,
          role: dto.role,
          teammates: dto.teammates ?? [],
          formAnswers: dto.formAnswers ?? [],
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

  async listForUser(userId: string) {
    return this.db.select().from(applications).where(eq(applications.userId, userId));
  }

  async listForBusinessOwner(ownerUserId: string, filters: { challengeId?: string; status?: string }) {
    const conditions = [eq(businesses.ownerUserId, ownerUserId)];
    if (filters.challengeId) conditions.push(eq(applications.challengeId, filters.challengeId));
    if (filters.status) conditions.push(eq(applications.status, filters.status));
    const rows = await this.db
      .select({ application: applications })
      .from(applications)
      .innerJoin(challenges, eq(applications.challengeId, challenges.id))
      .innerJoin(businesses, eq(challenges.businessId, businesses.id))
      .where(and(...conditions))
      .orderBy(desc(applications.createdAt));
    return rows.map(({ application }) => application);
  }

  // Visible to the applicant themselves, or to the business that owns the challenge.
  async findById(id: string, userId: string) {
    const row = await this.findWithBusinessOwner(id);
    if (!row || (row.application.userId !== userId && row.businessOwnerId !== userId)) {
      throw new NotFoundException('Application not found');
    }
    return row.application;
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
      .select({ application: applications, businessOwnerId: businesses.ownerUserId })
      .from(applications)
      .innerJoin(challenges, eq(applications.challengeId, challenges.id))
      .innerJoin(businesses, eq(challenges.businessId, businesses.id))
      .where(eq(applications.id, id))
      .limit(1);
    return row;
  }
}
