import { Inject, Injectable } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
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
}
