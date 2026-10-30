import { describe, expect, it, vi } from 'vitest';
vi.mock('../files/public-file-url.js', () => ({
  buildPublicFileUrl: vi.fn((file: { key: string }) => `https://cdn.test/${file.key}`),
}));

import { PeopleService } from './people.service.js';

function createDbStub(rows: unknown[], imageFiles: unknown[] = []) {
  const limit = vi.fn().mockResolvedValue(rows);
  const orderBy = vi.fn().mockReturnValue({ limit });
  const where = vi.fn().mockReturnValue({ orderBy });
  const from = vi.fn().mockReturnValue({ where });
  const filesWhere = vi.fn().mockResolvedValue(imageFiles);
  const select = vi
    .fn()
    .mockReturnValueOnce({ from })
    .mockReturnValue({ from: vi.fn().mockReturnValue({ where: filesWhere }) });
  return { db: { select }, where, orderBy, filesWhere };
}

describe('PeopleService.list', () => {
  it('maps profile links to badge flags without exposing the links themselves', async () => {
    const { db } = createDbStub(
      [
        {
          id: 'u1',
          name: '황지영',
          position: '프론트엔드',
          region: '부산',
          stacks: ['React'],
          externalLinks: [
            { label: 'GitHub', url: 'https://github.com/x' },
            { label: '블로그', url: 'https://blog.example/x', portfolioBadge: 'approved' },
          ],
          awardHistory: [{ title: '장려상' }],
          profileImageFileId: 'f1',
        },
        {
          id: 'u2',
          name: '김민수',
          position: null,
          region: null,
          stacks: [],
          externalLinks: [],
          awardHistory: [],
          profileImageFileId: null,
        },
      ],
      [{ id: 'f1', key: 'profiles/a.png' }],
    );
    const service = new PeopleService(db as any);

    const result = await service.list({}, 'viewer');

    expect(result[0]).toEqual({
      id: 'u1',
      name: '황지영',
      position: '프론트엔드',
      region: '부산',
      stacks: ['React'],
      profileImageUrl: 'https://cdn.test/profiles/a.png',
      hasGithub: true,
      hasPortfolio: true,
      hasAwards: true,
    });
    expect(result[1]).toMatchObject({
      profileImageUrl: null,
      hasGithub: false,
      hasPortfolio: false,
      hasAwards: false,
    });
    expect(result[0]).not.toHaveProperty('externalLinks');
  });

  it('does not grant the portfolio badge for links that did not request it', async () => {
    const { db } = createDbStub(
      [
        {
          id: 'u3',
          name: '이서연',
          position: null,
          region: null,
          stacks: [],
          externalLinks: [
            { label: '블로그', url: 'https://blog.example/y' },
            { label: '노션', url: 'https://notion.example/y', portfolioBadge: 'pending' },
          ],
          awardHistory: [],
          profileImageFileId: null,
        },
      ],
      [],
    );
    const service = new PeopleService(db as any);

    const result = await service.list({}, 'viewer');

    expect(result[0]).toMatchObject({ hasPortfolio: false });
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
