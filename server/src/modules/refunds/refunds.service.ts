import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
import { orders, payments, refundRequests, users } from '../../db/schema.js';
import { maskEmail } from '../admin/admin.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { OrdersService } from '../orders/orders.service.js';
import { PaymentsService } from '../payments/payments.service.js';
import { RefundRequestStatus } from './dto/refund-request.dto.js';

export const REFUND_RESULT_NOTIFICATION = 'refund.result';
const UNIQUE_VIOLATION = '23505';

@Injectable()
export class RefundsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly ordersService: OrdersService,
    private readonly paymentsService: PaymentsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /** 구매자 본인의 결제 완료 주문에 대해 환불을 요청한다(주문당 대기 요청 1건). */
  async request(userId: string, orderId: string, reason: string) {
    const normalizedReason = reason.trim();
    if (!normalizedReason) throw new BadRequestException('환불 사유를 입력해 주세요.');
    const order = await this.ordersService.findById(orderId, userId);
    if (order.status !== 'paid') {
      throw new ConflictException('결제가 완료된 주문만 환불을 요청할 수 있습니다.');
    }
    try {
      const [created] = await this.db
        .insert(refundRequests)
        .values({ orderId: order.id, userId, reason: normalizedReason })
        .returning();
      return created;
    } catch (error) {
      // drizzle이 pg 오류를 DrizzleQueryError(cause)로 감싸는 버전과 아닌 버전 모두 대응한다.
      const err = error as { code?: string; cause?: { code?: string } };
      if ((err.cause?.code ?? err.code) === UNIQUE_VIOLATION) {
        throw new ConflictException('이미 처리 대기 중인 환불 요청이 있습니다.');
      }
      throw error;
    }
  }

  /** 구매자 본인 주문의 환불 요청 이력(최신순). */
  async listForOrder(userId: string, orderId: string) {
    const order = await this.ordersService.findById(orderId, userId);
    return this.db
      .select({
        id: refundRequests.id,
        orderId: refundRequests.orderId,
        status: refundRequests.status,
        reason: refundRequests.reason,
        adminNote: refundRequests.adminNote,
        createdAt: refundRequests.createdAt,
        processedAt: refundRequests.processedAt,
      })
      .from(refundRequests)
      .where(eq(refundRequests.orderId, order.id))
      .orderBy(desc(refundRequests.createdAt));
  }

  async adminList(status?: RefundRequestStatus) {
    const rows = await this.db
      .select({
        id: refundRequests.id,
        orderId: refundRequests.orderId,
        status: refundRequests.status,
        reason: refundRequests.reason,
        adminNote: refundRequests.adminNote,
        createdAt: refundRequests.createdAt,
        processedAt: refundRequests.processedAt,
        amount: orders.amount,
        refundedAmount: payments.refundedAmount,
        isAd: orders.adId,
        requesterName: users.name,
        requesterEmail: users.email,
      })
      .from(refundRequests)
      .innerJoin(orders, eq(orders.id, refundRequests.orderId))
      .innerJoin(users, eq(users.id, refundRequests.userId))
      .leftJoin(payments, eq(payments.orderId, refundRequests.orderId))
      .where(status ? eq(refundRequests.status, status) : undefined)
      .orderBy(desc(refundRequests.createdAt));
    return rows.map(({ isAd, requesterEmail, refundedAmount, ...row }) => ({
      ...row,
      refundableAmount: row.amount - (refundedAmount ?? 0),
      orderType: isAd ? 'ad' : 'application',
      requesterEmail: requesterEmail ? maskEmail(requesterEmail) : '탈퇴한 사용자',
    }));
  }

  /**
   * 환불 승인 — Toss 결제 취소 후 결제·주문·요청 상태를 한 트랜잭션으로 전이하고
   * 구매자에게 알림을 남긴다. Toss 호출이 실패하면 요청은 requested로 남아 재시도할 수 있다.
   */
  async approve(id: string, adminId: string) {
    const request = await this.getOpenRequest(id);
    await this.paymentsService.refundPaidOrder(
      request.orderId,
      `구매자 환불 요청: ${request.reason}`.slice(0, 200),
      async (tx, refundedAmount) => {
        const [updated] = await tx
          .update(refundRequests)
          .set({ status: 'approved', processedBy: adminId, processedAt: new Date() })
          .where(and(eq(refundRequests.id, id), eq(refundRequests.status, 'requested')))
          .returning({ id: refundRequests.id });
        // 승인과 반려가 동시에 들어온 경우 — 롤백해 반려가 이긴 요청 상태를 덮어쓰지 않는다.
        // (이미 Toss 취소가 나갔다면 CANCELED 웹훅이 결제·주문을 수렴시킨다.)
        if (!updated) throw new ConflictException('이미 처리된 환불 요청입니다.');
        await this.notificationsService.create(
          request.userId,
          REFUND_RESULT_NOTIFICATION,
          { orderId: request.orderId, status: 'approved', amount: refundedAmount },
          tx,
        );
      },
      async (tx) => {
        const [locked] = await tx
          .select({ id: refundRequests.id })
          .from(refundRequests)
          .where(and(eq(refundRequests.id, id), eq(refundRequests.status, 'requested')))
          .for('update');
        if (!locked) throw new ConflictException('이미 처리된 환불 요청입니다.');
      },
    );
    return { id, status: 'approved' as const };
  }

  async reject(id: string, adminId: string, reason: string) {
    const request = await this.getOpenRequest(id);
    const note = reason.trim();
    if (!note) throw new BadRequestException('반려 사유를 입력해 주세요.');
    return this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(refundRequests)
        .set({ status: 'rejected', adminNote: note, processedBy: adminId, processedAt: new Date() })
        .where(and(eq(refundRequests.id, id), eq(refundRequests.status, 'requested')))
        .returning({ id: refundRequests.id });
      if (!updated) throw new ConflictException('이미 처리된 환불 요청입니다.');
      await this.notificationsService.create(
        request.userId,
        REFUND_RESULT_NOTIFICATION,
        { orderId: request.orderId, status: 'rejected', reason: note },
        tx,
      );
      return { id, status: 'rejected' as const };
    });
  }

  private async getOpenRequest(id: string) {
    const [request] = await this.db
      .select()
      .from(refundRequests)
      .where(eq(refundRequests.id, id))
      .limit(1);
    if (!request) throw new NotFoundException('환불 요청을 찾을 수 없습니다.');
    if (request.status !== 'requested') {
      throw new ConflictException('이미 처리된 환불 요청입니다.');
    }
    return request;
  }
}
