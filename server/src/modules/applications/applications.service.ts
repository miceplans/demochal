import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
import { applications, businesses, challenges, orders } from '../../db/schema.js';
import type { ApplyChallengeDto } from './dto/apply-challenge.dto.js';
import type { UpdateApplicationDto } from './dto/update-application.dto.js';

@Injectable()
export class ApplicationsService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async apply(dto: ApplyChallengeDto, userId: string) {
    return this.db.transaction(async (tx) => {
      const [challenge] = await tx
        .select({ price: challenges.price, title: challenges.title })
        .from(challenges)
        .where(eq(challenges.id, dto.challengeId))
        .limit(1);
      if (!challenge) throw new NotFoundException('Challenge not found');

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
        const [order] = await tx
          .insert(orders)
          .values({
            applicationId: application.id,
            userId,
            amount: challenge.price,
            status: 'pending',
          })
          .returning();
        if (!order) throw new Error('Failed to create order');

        // The client settles this pending order via Toss and watches it through
        // GET /orders/{id} — orderId/amount feed the payment request, name the
        // Toss orderName display.
        return {
          ...application,
          order: { id: order.id, amount: order.amount, name: challenge.title },
        };
      }

      return { ...application, order: null };
    });
  }

  async listForUser(userId: string) {
    return this.db.select().from(applications).where(eq(applications.userId, userId));
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
