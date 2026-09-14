import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
import { bookmarks, challenges } from '../../db/schema.js';

export type BookmarkSort = 'deadline' | 'latest' | 'popular';

@Injectable()
export class BookmarksService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async list(userId: string, sort: BookmarkSort = 'latest') {
    const orderBy =
      sort === 'deadline'
        ? asc(challenges.endDate)
        : sort === 'popular'
          ? desc(challenges.viewCount)
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
    if (bookmarked) {
      // Unique (userId, challengeId) makes a re-toggle idempotent.
      await this.db
        .insert(bookmarks)
        .values({ userId, challengeId })
        .onConflictDoNothing({ target: [bookmarks.userId, bookmarks.challengeId] });
    } else {
      await this.db
        .delete(bookmarks)
        .where(and(eq(bookmarks.userId, userId), eq(bookmarks.challengeId, challengeId)));
    }
    return { bookmarked };
  }
}
