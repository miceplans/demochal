import { BadGatewayException, ConflictException, Inject, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { and, desc, eq, gte } from 'drizzle-orm';
import { fetchJson } from '../../common/http/fetch-json.js';
import { env } from '../../config/env.js';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
import { billingAuthAttempts, paymentCards } from '../../db/schema.js';
import type { RegisterPaymentCardDto } from './dto/register-payment-card.dto.js';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  // billingKey는 절대 반환하지 않는다(PCI 범위는 토스에 남음): 컬럼 투영으로 아예 제외.
  listCards(businessId: string) {
    return this.db
      .select({
        id: paymentCards.id,
        cardName: paymentCards.cardName,
        maskedNumber: paymentCards.maskedNumber,
      })
      .from(paymentCards)
      .where(eq(paymentCards.businessId, businessId))
      .orderBy(desc(paymentCards.createdAt));
  }

  async registerCard(businessId: string, dto: RegisterPaymentCardDto) {
    const [card] = await this.db
      .insert(paymentCards)
      .values({
        businessId,
        billingKey: dto.billingKey,
        cardName: dto.cardName,
        maskedNumber: dto.maskedNumber,
      })
      .returning({
        id: paymentCards.id,
        cardName: paymentCards.cardName,
        maskedNumber: paymentCards.maskedNumber,
      });
    return card;
  }

  // 빌링 인증(customerKey)은 businessId에서 유도한다 — 클라이언트가 사전에 키를 알 필요 없게.
  getCustomerKey(businessId: string) {
    return `semochal-biz-${businessId}`;
  }

  // authKey를 토스 billingKey로 교환하고 카드를 저장한다. billingKey는 저장 후 절대 반환하지 않는다.
  // authKey 원본 대신 sha256 해시로 멱등 레코드를 찾는다 — 토스가 카드를 저장한 뒤 HTTP 응답이
  // 사라져 콜백이 같은 authKey로 재호출되어도 저장된 카드를 실패로 보고하거나 중복 등록하지 않는다.
  async issueCard(businessId: string, authKey: string) {
    if (!env.tossSecretKey) throw new BadGatewayException('Toss billing is not configured');

    const authKeyHash = createHash('sha256').update(authKey).digest('hex');
    const [inserted] = await this.db
      .insert(billingAuthAttempts)
      .values({ businessId, authKeyHash })
      .onConflictDoNothing({ target: billingAuthAttempts.authKeyHash })
      .returning({ id: billingAuthAttempts.id });

    if (!inserted) {
      // 동일 authKey 재시도 — 레코드에 연결된 카드가 있으면 그 카드를 성공으로 돌려준다.
      const [attempt] = await this.db
        .select()
        .from(billingAuthAttempts)
        .where(eq(billingAuthAttempts.authKeyHash, authKeyHash))
        .limit(1);
      // The insert conflicted on the unique hash, so the row must exist; guard
      // anyway so a retry never crashes on a half-visible read.
      if (!attempt) throw new Error('Billing auth attempt missing after insert conflict');
      if (attempt.cardId) {
        const [card] = await this.db
          .select({
            id: paymentCards.id,
            cardName: paymentCards.cardName,
            maskedNumber: paymentCards.maskedNumber,
          })
          .from(paymentCards)
          .where(and(eq(paymentCards.id, attempt.cardId), eq(paymentCards.businessId, businessId)))
          .limit(1);
        if (card) return card;
      }
      // 응답 손실로 카드만 등록된 경우를 대비해, 시도 시각 이후에 생긴 카드가 있으면 그것을 연결한다.
      const [orphan] = await this.db
        .select({
          id: paymentCards.id,
          cardName: paymentCards.cardName,
          maskedNumber: paymentCards.maskedNumber,
        })
        .from(paymentCards)
        .where(
          and(
            eq(paymentCards.businessId, businessId),
            gte(paymentCards.createdAt, attempt.createdAt),
          ),
        )
        .orderBy(desc(paymentCards.createdAt))
        .limit(1);
      if (orphan) {
        await this.db
          .update(billingAuthAttempts)
          .set({ cardId: orphan.id })
          .where(eq(billingAuthAttempts.id, attempt.id));
        return orphan;
      }
      // 교환이 확인되지 않은 재시도 — 같은 one-time 키로 토스를 다시 호출하지 않는다.
      throw new ConflictException('이미 처리된 인증 요청입니다. 결제수단 목록을 확인해주세요.');
    }

    const authorization = Buffer.from(`${env.tossSecretKey}:`).toString('base64');
    let response;
    try {
      response = await fetchJson('https://api.tosspayments.com/v1/billing/authorizations/issue', {
        method: 'POST',
        headers: { Authorization: `Basic ${authorization}` },
        body: JSON.stringify({ authKey, customerKey: this.getCustomerKey(businessId) }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (error) {
      // 응답 손실·타임아웃·DNS 등 운영에서 원인을 추적할 수 있게 기록한다.
      // authKey·billingKey·카드 번호는 절대 로그에 남기지 않는다.
      // 요청이 토스에 도달했는지 알 수 없으므로 멱등 레코드를 지워 재시도가 교환을 다시 시도하게 한다.
      this.logger.error(
        `Toss billing authorization transport failed for business ${businessId}`,
        (error as Error | undefined)?.stack,
      );
      await this.db.delete(billingAuthAttempts).where(eq(billingAuthAttempts.id, inserted.id));
      throw new BadGatewayException('Toss billing authorization failed');
    }
    if (!response.ok) {
      // 토스 진단 정보는 상태 코드와 에러 코드만 남긴다(요청 자격증명·카드 데이터 제외).
      // 응답은 도착했으므로 one-time 키는 소진된 것으로 보고 멱등 레코드를 유지한다.
      const providerCode = await response
        .json()
        .then((body) =>
          body && typeof body === 'object' ? (body as { code?: string }).code : undefined,
        )
        .catch(() => undefined);
      this.logger.error(
        `Toss billing authorization rejected for business ${businessId}: HTTP ${response.status}${
          providerCode ? `, code ${providerCode}` : ''
        }`,
      );
      throw new BadGatewayException('Toss billing authorization failed');
    }

    const issued = (await response.json()) as { billingKey?: string; card?: { number?: string } };
    if (!issued.billingKey || !issued.card?.number) {
      throw new BadGatewayException('Toss billing authorization response incomplete');
    }

    const [card] = await this.db
      .insert(paymentCards)
      .values({
        businessId,
        billingKey: issued.billingKey,
        maskedNumber: issued.card.number,
      })
      .returning({
        id: paymentCards.id,
        cardName: paymentCards.cardName,
        maskedNumber: paymentCards.maskedNumber,
      });
    if (!card) throw new Error('Failed to register card');

    await this.db
      .update(billingAuthAttempts)
      .set({ cardId: card.id })
      .where(eq(billingAuthAttempts.id, inserted.id));
    return card;
  }
}
