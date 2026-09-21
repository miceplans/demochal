import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { applications, challenges } from '../../db/schema.js';
import { ApplicationsService } from './applications.service.js';
import type { ApplyChallengeDto } from './dto/apply-challenge.dto.js';

/** Chainable drizzle stub matching apply(): select projections, insert().values().returning(), and transaction pass-through. */
function createDbStub(options: {
  challenge?: { id: string; price: number; title: string };
  existingApplication?: Record<string, unknown>;
  latestOrder?: Record<string, unknown>;
  application?: Record<string, unknown>;
  order?: Record<string, unknown>;
}) {
  const limit = vi.fn();
  const selectFrom = vi.fn((table: unknown) => ({
    where: vi.fn(() => {
      if (table === challenges) {
        limit.mockResolvedValue(options.challenge ? [options.challenge] : []);
        return { limit };
      }
      if (table === applications) {
        limit.mockResolvedValue(
          options.existingApplication ? [options.existingApplication] : [],
        );
        return { limit };
      }
      // orders (latest lookup in orderForApplication)
      limit.mockResolvedValue(options.latestOrder ? [options.latestOrder] : []);
      return { orderBy: vi.fn(() => ({ limit })), limit };
    }),
  }));
  const select = vi.fn(() => ({ from: selectFrom }));

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
      challenge: { id: 'challenge-1', price: 10000, title: '유료 챌린지' },
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
      challenge: { id: 'challenge-1', price: 0, title: 'Free Challenge' },
      application: { id: 'app-2', challengeId: 'challenge-1', userId: 'user-1' },
    });
    const service = new ApplicationsService(db);

    const result = await service.apply(dto, 'user-1');

    expect(result.order).toBeNull();
  });

  it('fails when the paid order insert returns no row', async () => {
    const db = createDbStub({
      challenge: { id: 'challenge-1', price: 10000, title: '유료 챌린지' },
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

  it('truncates the Toss orderName to the 100-character limit', async () => {
    const longTitle = '해'.repeat(150);
    const db = createDbStub({
      challenge: { id: 'challenge-1', price: 10000, title: longTitle },
      application: { id: 'app-1', challengeId: 'challenge-1', userId: 'user-1' },
      order: { id: 'order-1', amount: 10000 },
    });
    const service = new ApplicationsService(db);

    const result = await service.apply(dto, 'user-1');

    expect(result.order?.name).toHaveLength(100);
    expect(result.order?.name.endsWith('…')).toBe(true);
  });

  it('reuses the existing application and its pending order on retry instead of inserting duplicates', async () => {
    const db = createDbStub({
      challenge: { id: 'challenge-1', price: 10000, title: '유료 챌린지' },
      existingApplication: { id: 'app-1', challengeId: 'challenge-1', userId: 'user-1' },
      latestOrder: { id: 'order-1', amount: 10000, status: 'pending' },
    });
    const service = new ApplicationsService(db);

    const result = await service.apply(dto, 'user-1');

    expect(result.id).toBe('app-1');
    expect(result.order).toEqual({ id: 'order-1', amount: 10000, name: '유료 챌린지' });
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('creates a replacement pending order when the previous order reached a terminal unpaid state', async () => {
    const db = createDbStub({
      challenge: { id: 'challenge-1', price: 10000, title: '유료 챌린지' },
      existingApplication: { id: 'app-1', challengeId: 'challenge-1', userId: 'user-1' },
      latestOrder: { id: 'order-1', amount: 10000, status: 'canceled' },
      order: { id: 'order-2', amount: 10000 },
    });
    const service = new ApplicationsService(db);

    const result = await service.apply(dto, 'user-1');

    expect(result.order?.id).toBe('order-2');
  });

  it('returns a null order for an existing application whose order is already paid', async () => {
    const db = createDbStub({
      challenge: { id: 'challenge-1', price: 10000, title: '유료 챌린지' },
      existingApplication: { id: 'app-1', challengeId: 'challenge-1', userId: 'user-1' },
      latestOrder: { id: 'order-1', amount: 10000, status: 'paid' },
    });
    const service = new ApplicationsService(db);

    const result = await service.apply(dto, 'user-1');

    expect(result.id).toBe('app-1');
    expect(result.order).toBeNull();
  });
});
