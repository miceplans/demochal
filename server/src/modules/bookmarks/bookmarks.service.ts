import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
import { bookmarks, challenges } from '../../db/schema.js';

type Sort = 'deadline' | 'latest' | 'popular';

@Injectable()
export class BookmarksService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async listForUser(userId: string, sort: Sort = 'latest') {
    const orderBy =
      sort === 'deadline'
        ? asc(challenges.endDate)
        : sort === 'popular'
          ? sql`(select count(*) from bookmarks b2 where b2.challenge_id = ${challenges.id}) desc`
          : desc(bookmarks.createdAt);

    const rows = await this.db
      .select({ challenge: challenges })
      .from(bookmarks)
      .innerJoin(challenges, eq(bookmarks.challengeId, challenges.id))
      .where(eq(bookmarks.userId, userId))
      .orderBy(orderBy);

    return rows.map((row) => row.challenge);
  }

  async toggle(userId: string, challengeId: string, bookmarked: boolean) {
    const [existing] = await this.db
      .select()
      .from(bookmarks)
      .where(and(eq(bookmarks.userId, userId), eq(bookmarks.challengeId, challengeId)))
      .limit(1);

    if (bookmarked && !existing) {
      await this.db.insert(bookmarks).values({ userId, challengeId });
    } else if (!bookmarked && existing) {
      await this.db
        .delete(bookmarks)
        .where(and(eq(bookmarks.userId, userId), eq(bookmarks.challengeId, challengeId)));
    }

    return { bookmarked };
  }
}
