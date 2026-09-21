import { BadGatewayException, Inject, Injectable } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { fetchJson } from '../../common/http/fetch-json.js';
import { env } from '../../config/env.js';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
import { paymentCards } from '../../db/schema.js';
import type { RegisterPaymentCardDto } from './dto/register-payment-card.dto.js';

@Injectable()
export class BillingService {
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
  async issueCard(businessId: string, authKey: string) {
    if (!env.tossSecretKey) throw new BadGatewayException('Toss billing is not configured');

    const authorization = Buffer.from(`${env.tossSecretKey}:`).toString('base64');
    let response;
    try {
      response = await fetchJson('https://api.tosspayments.com/v1/billing/authorizations/issue', {
        method: 'POST',
        headers: { Authorization: `Basic ${authorization}` },
        body: JSON.stringify({ authKey, customerKey: this.getCustomerKey(businessId) }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new BadGatewayException('Toss billing authorization failed');
    }
    if (!response.ok) throw new BadGatewayException('Toss billing authorization failed');

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
    return card;
  }
}
