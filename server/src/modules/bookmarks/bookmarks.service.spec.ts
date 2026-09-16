import { describe, expect, it, vi } from 'vitest';
import { asc, desc } from 'drizzle-orm';
import { bookmarks, challenges } from '../../db/schema.js';
import { BookmarksService } from './bookmarks.service.js';

function listChain(rows: unknown[]) {
  const orderBy = vi.fn().mockResolvedValue(rows);
  const where = vi.fn().mockReturnValue({ orderBy });
  const innerJoin = vi.fn().mockReturnValue({ where });
  const from = vi.fn().mockReturnValue({ innerJoin });
  return { from, orderBy };
}

function createDbStub() {
  return {
    select: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
  } as any;
}

const challengeRows = [{ challenge: { id: 'challenge-1', title: 'AI 챌린지' } }];

describe('BookmarksService', () => {
  it('list maps sort=deadline to endDate ascending and returns challenge rows', async () => {
    const db = createDbStub();
    const chain = listChain(challengeRows);
    db.select.mockReturnValue(chain);
    const service = new BookmarksService(db);

    const result = await service.list('user-1', 'deadline');

    expect(chain.orderBy).toHaveBeenCalledWith(asc(challenges.endDate));
    expect(result).toEqual([{ id: 'challenge-1', title: 'AI 챌린지' }]);
  });

  it('list maps sort=latest to bookmark createdAt descending', async () => {
    const db = createDbStub();
    const chain = listChain(challengeRows);
    db.select.mockReturnValue(chain);
    const service = new BookmarksService(db);

    await service.list('user-1', 'latest');

    expect(chain.orderBy).toHaveBeenCalledWith(desc(bookmarks.createdAt));
  });

  it('list maps sort=popular to challenge viewCount descending', async () => {
    const db = createDbStub();
    const chain = listChain(challengeRows);
    db.select.mockReturnValue(chain);
    const service = new BookmarksService(db);

    await service.list('user-1', 'popular');

    expect(chain.orderBy).toHaveBeenCalledWith(desc(challenges.viewCount));
  });

  it('toggle(true) inserts with onConflictDoNothing on the unique pair', async () => {
    const db = createDbStub();
    const onConflictDoNothing = vi.fn().mockResolvedValue(undefined);
    const values = vi.fn().mockReturnValue({ onConflictDoNothing });
    db.insert = vi.fn().mockReturnValue({ values });
    const service = new BookmarksService(db);

    const result = await service.toggle('user-1', 'challenge-1', true);

    expect(values).toHaveBeenCalledWith({ userId: 'user-1', challengeId: 'challenge-1' });
    expect(onConflictDoNothing).toHaveBeenCalledWith({
      target: [bookmarks.userId, bookmarks.challengeId],
    });
    expect(result).toEqual({ bookmarked: true });
  });

  it('toggle(false) deletes the bookmark row', async () => {
    const db = createDbStub();
    const where = vi.fn().mockResolvedValue(undefined);
    db.delete = vi.fn().mockReturnValue({ where });
    const service = new BookmarksService(db);

    const result = await service.toggle('user-1', 'challenge-1', false);

    expect(where).toHaveBeenCalled();
    expect(result).toEqual({ bookmarked: false });
  });
});
