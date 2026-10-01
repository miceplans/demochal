import { describe, expect, it, vi } from 'vitest';
import { PeopleService } from './people.service.js';

function createDbStub(rows: unknown[]) {
  const limit = vi.fn().mockResolvedValue(rows);
  const orderBy = vi.fn().mockReturnValue({ limit });
  const where = vi.fn().mockReturnValue({ orderBy });
  const from = vi.fn().mockReturnValue({ where });
  return { db: { select: vi.fn().mockReturnValue({ from }) }, where, orderBy };
}

describe('PeopleService.list', () => {
  it('maps profile links to badge flags without exposing the links themselves', async () => {
    const { db } = createDbStub([
      {
        id: 'u1',
        name: '황지영',
        position: '프론트엔드',
        region: '부산',
        stacks: ['React'],
        externalLinks: [
          { label: 'GitHub', url: 'https://github.com/x' },
          { label: '블로그', url: 'https://blog.example/x' },
        ],
        awardHistory: [{ title: '장려상' }],
      },
      {
        id: 'u2',
        name: '김민수',
        position: null,
        region: null,
        stacks: [],
        externalLinks: [],
        awardHistory: [],
      },
    ]);
    const service = new PeopleService(db as any);

    const result = await service.list({}, 'viewer');

    expect(result[0]).toEqual({
      id: 'u1',
      name: '황지영',
      position: '프론트엔드',
      region: '부산',
      stacks: ['React'],
      hasGithub: true,
      hasPortfolio: true,
      hasAwards: true,
    });
    expect(result[1]).toMatchObject({ hasGithub: false, hasPortfolio: false, hasAwards: false });
    expect(result[0]).not.toHaveProperty('externalLinks');
  });

  it('applies filters and sort without throwing for empty and comma lists', async () => {
    const { db, where, orderBy } = createDbStub([]);
    const service = new PeopleService(db as any);

    await expect(
      service.list(
        { q: '100%_', sort: 'name', position: 'a, b', region: '', stack: 'React,Go' },
        'v',
      ),
    ).resolves.toEqual([]);
    expect(where).toHaveBeenCalledTimes(1);
    expect(orderBy).toHaveBeenCalledTimes(1);
  });
});
