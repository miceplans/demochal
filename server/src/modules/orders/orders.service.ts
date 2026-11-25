import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, count, eq, ne } from 'drizzle-orm';
import { DRIZZLE, type Database, type DbTx } from '../../db/drizzle.provider.js';
import { ads, applications, challenges, orders } from '../../db/schema.js';
import { adToday } from '../ads/ad-period.js';
import { effectiveApplicationCondition } from '../applications/effective-application.js';
import { NotificationsService } from '../notifications/notifications.service.js';

@Injectable()
export class OrdersService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly notificationsService: NotificationsService,
  ) {}

  async findById(id: string, userId: string) {
    const [order] = await this.db.select().from(orders).where(eq(orders.id, id)).limit(1);
    if (!order || order.userId !== userId) throw new NotFoundException('주문을 찾을 수 없습니다.');
    return order;
  }

  /** Trusted server-side lookup (webhooks, internal jobs) — no ownership check. */
  async findByIdInternal(id: string) {
    const [order] = await this.db.select().from(orders).where(eq(orders.id, id)).limit(1);
    if (!order) throw new NotFoundException('주문을 찾을 수 없습니다.');
    return order;
  }

  async markPaid(id: string) {
    return this.db.transaction((tx) => this.settleOrderPaid(tx, id));
  }

  /** Caller-supplied transaction so the payment write can commit atomically with the order transition. */
  async settleOrderPaid(tx: DbTx, id: string) {
    const [existing] = await tx.select().from(orders).where(eq(orders.id, id)).for('update');
    if (!existing) throw new NotFoundException('주문을 찾을 수 없습니다.');
    if (existing.status === 'paid') return existing;
    if (existing.status !== 'pending') throw new ConflictException('결제할 수 없는 주문입니다.');
    if (existing.adId) {
      const [ad] = await tx.select().from(ads).where(eq(ads.id, existing.adId)).for('update');
      if (!ad || ad.status !== 'preparing' || ad.endDate < adToday()) {
        throw new ConflictException('종료되거나 취소된 광고 계약입니다.');
      }
      // Same cutoff as AdsService.reservingCondition: once expiresAt passes,
      // the reservation stops holding its dates and another buyer may own
      // them, so settling now would double-book. ConflictException drives the
      // Toss refund compensation in PaymentsService.
      if (!ad.expiresAt || ad.expiresAt.getTime() <= Date.now()) {
        throw new ConflictException('결제 마감 시간이 지난 광고 예약입니다.');
      }
    }
    if (existing.applicationId) await this.assertSeatAvailable(tx, existing.applicationId);
    const [order] = await tx
      .update(orders)
      .set({ status: 'paid' })
      .where(eq(orders.id, id))
      .returning();

    if (order?.adId) {
      await tx.update(ads).set({ status: 'active' }).where(eq(ads.id, order.adId));
    }

    // 유료 챌린지 신청은 결제 확정 시점에 접수 완료 알림을 보낸다(무료는 ApplicationsService.apply).
    if (order?.applicationId) {
      const [target] = await tx
        .select({ challengeId: challenges.id, challengeTitle: challenges.title })
        .from(applications)
        .innerJoin(challenges, eq(challenges.id, applications.challengeId))
        .where(eq(applications.id, order.applicationId))
        .limit(1);
      if (target) {
        await this.notificationsService.create(
          order.userId,
          'application.submitted',
          { applicationId: order.applicationId, ...target },
          tx,
        );
      }
    }

    return order;
  }

  /**
   * 유료 신청은 신청 시점이 아니라 결제 확정 시점에 정원을 차지하므로 여기서 다시 확인한다.
   * ApplicationsService.apply와 같은 공고 row를 잠가 동시 결제·무료 신청과 직렬화하고,
   * ConflictException으로 PaymentsService의 자동 환불을 유도한다(광고 예약 만료와 같은 계약).
   */
  private async assertSeatAvailable(tx: DbTx, applicationId: string) {
    const [application] = await tx
      .select({ challengeId: applications.challengeId })
      .from(applications)
      .where(eq(applications.id, applicationId))
      .limit(1);
    if (!application) return;
    const [challenge] = await tx
      .select({ capacity: challenges.capacity })
      .from(challenges)
      .where(eq(challenges.id, application.challengeId))
      .limit(1)
      .for('no key update');
    if (challenge?.capacity === null || challenge?.capacity === undefined) return;
    const [accepted] = await tx
      .select({ total: count() })
      .from(applications)
      .where(
        and(
          eq(applications.challengeId, application.challengeId),
          ne(applications.id, applicationId),
          effectiveApplicationCondition,
        ),
      );
    if (Number(accepted?.total ?? 0) >= challenge.capacity) {
      throw new ConflictException('모집 정원이 마감된 챌린지입니다.');
    }
  }

  async markCancelled(id: string) {
    return this.db.transaction((tx) => this.cancelOrder(tx, id));
  }

  /** Caller-supplied transaction so the cancellation can commit atomically with a related write. */
  async cancelOrder(tx: DbTx, id: string, allowedFrom: string[] = ['pending', 'paid']) {
    const [existing] = await tx.select().from(orders).where(eq(orders.id, id)).for('update');
    if (!existing) throw new NotFoundException('주문을 찾을 수 없습니다.');
    if (existing.status === 'canceled') return existing;
    if (!allowedFrom.includes(existing.status)) {
      throw new ConflictException('취소할 수 없는 주문입니다.');
    }
    const wasPaid = existing.status === 'paid';
    const [order] = await tx
      .update(orders)
      .set({ status: 'canceled' })
      .where(eq(orders.id, id))
      .returning();

    // A canceled pending ad must release its reserved dates immediately;
    // reservingCondition checks ad status, not the linked order status.
    // The order row lock serializes this with settlement.
    if (existing.adId) {
      await tx
        .update(ads)
        .set({ status: 'ended' })
        .where(and(eq(ads.id, existing.adId), eq(ads.status, wasPaid ? 'active' : 'preparing')));
    }

    return order;
  }

  /** 신청자 본인의 미결제 pending 주문만 취소한다(토스 진입 실패·구매자 취소 정리). */
  async cancelPendingByOwner(id: string, userId: string) {
    const order = await this.findById(id, userId);
    return this.db.transaction((tx) => this.cancelOrder(tx, order.id, ['pending']));
  }
}
