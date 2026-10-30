import { ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { createDbStub, createService } from './admin.test-helpers.js';

const pendingLinks = [
  { label: '블로그', url: 'https://blog.example/a', portfolioBadge: 'pending' },
  { label: '노션', url: 'https://notion.example/b' },
];

function serviceWith(select: unknown[]) {
  const stub = createDbStub({ select, update: [[]] });
  const { service } = createService(stub.db);
  return { service, setCalls: stub.setCalls };
}

describe('AdminService portfolio badge review', () => {
  it('approves a pending link and leaves the others untouched', async () => {
    const { service, setCalls } = serviceWith([[{ id: 'u1', externalLinks: pendingLinks }]]);

    await expect(
      service.reviewPortfolioBadge('u1', { url: 'https://blog.example/a', action: 'approve' }),
    ).resolves.toMatchObject({ status: 'approved' });
    expect(setCalls[0]?.[0]).toEqual({
      externalLinks: [
        { label: '블로그', url: 'https://blog.example/a', portfolioBadge: 'approved' },
        { label: '노션', url: 'https://notion.example/b' },
      ],
    });
  });

  it('rejects by clearing only the request flag', async () => {
    const { service, setCalls } = serviceWith([[{ id: 'u1', externalLinks: pendingLinks }]]);

    await service.reviewPortfolioBadge('u1', { url: 'https://blog.example/a', action: 'reject' });

    expect(setCalls[0]?.[0]).toEqual({
      externalLinks: [
        { label: '블로그', url: 'https://blog.example/a' },
        { label: '노션', url: 'https://notion.example/b' },
      ],
    });
  });

  it('409 when the link is not pending, 404 when the user is missing', async () => {
    await expect(
      serviceWith([[{ id: 'u1', externalLinks: pendingLinks }]]).service.reviewPortfolioBadge(
        'u1',
        {
          url: 'https://notion.example/b',
          action: 'approve',
        },
      ),
    ).rejects.toThrow(ConflictException);
    await expect(
      serviceWith([[]]).service.reviewPortfolioBadge('x', { url: 'u', action: 'approve' }),
    ).rejects.toThrow(NotFoundException);
  });
});
