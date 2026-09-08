import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { desc, eq, lt } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
import { challenges } from '../../db/schema.js';
import type { CreateChallengeDto } from './dto/create-challenge.dto.js';

@Injectable()
export class ChallengesService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  // Keyset pagination on createdAt. Good enough while volume is low; revisit
  // with a compound (createdAt, id) cursor if createdAt collisions appear.
  async list(cursor: string | undefined, limit: number) {
    const where = cursor ? lt(challenges.createdAt, new Date(cursor)) : undefined;
    const rows = await this.db
      .select()
      .from(challenges)
      .where(where)
      .orderBy(desc(challenges.createdAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit);
    const nextCursor = hasMore ? items[items.length - 1]!.createdAt.toISOString() : null;
    return { items, nextCursor };
  }

  async findById(id: string) {
    const [challenge] = await this.db
      .select()
      .from(challenges)
      .where(eq(challenges.id, id))
      .limit(1);
    if (!challenge) throw new NotFoundException('Challenge not found');
    return challenge;
  }

  async create(dto: CreateChallengeDto) {
    const [challenge] = await this.db
      .insert(challenges)
      .values({
        businessId: dto.businessId,
        title: dto.title,
        description: dto.description,
        price: dto.price,
        capacity: dto.capacity,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
      })
      .returning();
    return challenge;
  }
}
