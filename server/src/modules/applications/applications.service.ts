import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
import { applications } from '../../db/schema.js';
import type { ApplyChallengeDto } from './dto/apply-challenge.dto.js';

@Injectable()
export class ApplicationsService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  // TODO: derive userId from the authenticated request once auth is implemented.
  async apply(dto: ApplyChallengeDto, userId: string) {
    const [application] = await this.db
      .insert(applications)
      .values({ challengeId: dto.challengeId, userId })
      .returning();
    return application;
  }

  async listForUser(userId: string) {
    return this.db.select().from(applications).where(eq(applications.userId, userId));
  }
}
