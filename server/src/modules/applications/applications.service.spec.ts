import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { applications } from '../../db/schema.js';
import { ApplicationsService } from './applications.service.js';
import type { ApplyChallengeDto } from './dto/apply-challenge.dto.js';

/** Chainable drizzle stub matching apply(): select().from().where().limit() and insert().values().returning(). */
function createDbStub(options: {
  challenge?: { price: number; title: string };
  application?: Record<string, unknown>;
  order?: Record<string, unknown>;
}) {
  const limit = vi.fn().mockResolvedValue(options.challenge ? [options.challenge] : []);
  const selectWhere = vi.fn().mockReturnValue({ limit });
  const selectFrom = vi.fn().mockReturnValue({ where: selectWhere });
  const select = vi.fn().mockReturnValue({ from: selectFrom });

  const insert = vi.fn((table: unknown) => ({
    values: vi.fn(() => ({
      returning: vi
        .fn()
        .mockResolvedValue(
          table === applications
            ? options.application
              ? [options.application]
              : []
            : options.order
              ? [options.order]
              : [],
        ),
    })),
  }));

  const db: any = { select, insert };
  db.transaction = vi.fn((cb: (tx: unknown) => unknown) => cb(db));
  return db;
}

const dto: ApplyChallengeDto = { challengeId: 'challenge-1' };

describe('ApplicationsService.apply', () => {
  it('returns the pending order info for a paid challenge', async () => {
    const db = createDbStub({
      challenge: { price: 10000, title: '유료 챌린지' },
      application: { id: 'app-1', challengeId: 'challenge-1', userId: 'user-1' },
      order: { id: 'order-1', amount: 10000 },
    });
    const service = new ApplicationsService(db);

    const result = await service.apply(dto, 'user-1');

    expect(result.order).toEqual({ id: 'order-1', amount: 10000, name: '유료 챌린지' });
    expect(result.id).toBe('app-1');
  });

  it('returns a null order for a free challenge (price 0)', async () => {
    const db = createDbStub({
      challenge: { price: 0, title: '무료 챌린지' },
      application: { id: 'app-2', challengeId: 'challenge-1', userId: 'user-1' },
    });
    const service = new ApplicationsService(db);

    const result = await service.apply(dto, 'user-1');

    expect(result.order).toBeNull();
  });

  it('fails when the paid order insert returns no row', async () => {
    const db = createDbStub({
      challenge: { price: 10000, title: '유료 챌린지' },
      application: { id: 'app-1', challengeId: 'challenge-1', userId: 'user-1' },
    });
    const service = new ApplicationsService(db);

    await expect(service.apply(dto, 'user-1')).rejects.toThrow('Failed to create order');
  });

  it('throws NotFoundException for a missing challenge', async () => {
    const db = createDbStub({});
    const service = new ApplicationsService(db);

    await expect(service.apply(dto, 'user-1')).rejects.toThrow(NotFoundException);
  });
});
