import { describe, expect, it, vi } from 'vitest';

/** eq/and 호출을 기록해 where 절의 실제 predicate를 검증한다. */
const predicates = vi.hoisted(() => ({
  eqCalls: [] as Array<{ column: unknown; value: unknown }>,
  andCalls: [] as unknown[][],
}));

vi.mock('drizzle-orm', async (importActual) => {
  const actual = await importActual<typeof import('drizzle-orm')>();
  return {
    ...actual,
    eq: (column: unknown, value: unknown) => {
      predicates.eqCalls.push({ column, value });
      return { op: 'eq', column, value };
    },
    and: (...conditions: unknown[]) => {
      predicates.andCalls.push(conditions);
      return { op: 'and', conditions };
    },
  };
});

import { businesses } from '../../db/schema.js';
import { BusinessesService } from './businesses.service.js';

/** update().set().where().returning() chain. */
function createDbStub(updated: Record<string, unknown> | undefined) {
  const returning = vi.fn().mockResolvedValue(updated ? [updated] : []);
  const where = vi.fn().mockReturnValue({ returning });
  const set = vi.fn().mockReturnValue({ where });
  const update = vi.fn(() => ({ set }));
  const db: any = { update };
  return { db, set, where };
}

describe('BusinessesService', () => {
  it('scopes the update to the authenticated owner and applies only provided fields', async () => {
    const { db, set, where } = createDbStub({ id: 'biz-1', name: '새 이름' });
    const service = new BusinessesService(db, { notify: vi.fn() } as any);

    await service.update('biz-1', { name: '새 이름', bannerImageFileId: 'file-1' }, 'user-1');

    expect(set).toHaveBeenCalledWith({
      name: '새 이름',
      bannerImageFileId: 'file-1',
    });
    // where 절이 business id와 owner id를 AND로 결합한 조건이어야 한다.
    // 호출 여부만 검증하면 owner 조건 제거를 회귀 테스트가 감지하지 못한다.
    expect(where).toHaveBeenCalledWith({
      op: 'and',
      conditions: [
        { op: 'eq', column: businesses.id, value: 'biz-1' },
        { op: 'eq', column: businesses.ownerUserId, value: 'user-1' },
      ],
    });
    expect(predicates.eqCalls).toContainEqual({ column: businesses.id, value: 'biz-1' });
    expect(predicates.eqCalls).toContainEqual({
      column: businesses.ownerUserId,
      value: 'user-1',
    });
  });

  it('rejects with NotFound when no row matches id and owner (no partial leak)', async () => {
    const { db } = createDbStub(undefined);
    const service = new BusinessesService(db, { notify: vi.fn() } as any);

    await expect(service.update('biz-2', { name: '새 이름' }, 'user-1')).rejects.toThrow(
      'Business not found or not owned by user',
    );
  });
});

describe('BusinessesService.register', () => {
  function createRegisterDb(existing: unknown[]) {
    const created = { id: 'biz-new', verificationStatus: 'pending', ownerUserId: 'user-1' };
    const tx: any = {
      insert: () => ({ values: () => ({ returning: async () => [created] }) }),
      update: () => ({ set: () => ({ where: async () => [] }) }),
    };
    const db: any = {
      select: () => ({ from: () => ({ where: () => ({ limit: async () => existing }) }) }),
      transaction: async (callback: (tx: unknown) => unknown) => callback(tx),
    };
    return db;
  }

  it('raises the newBusinessAlert admin alert with the business id only', async () => {
    const alerts = { notify: vi.fn().mockResolvedValue(undefined) };
    const service = new BusinessesService(createRegisterDb([]), alerts as any);

    await service.register(
      { name: '한빛협회', registrationNumber: '123-45-67890', type: 'corp' } as any,
      'user-1',
    );

    expect(alerts.notify).toHaveBeenCalledWith('newBusinessAlert', 'admin.business', {
      businessId: 'biz-new',
    });
  });

  it('does not alert when the owner already has a business', async () => {
    const alerts = { notify: vi.fn() };
    const service = new BusinessesService(createRegisterDb([{ id: 'biz-old' }]), alerts as any);

    await expect(service.register({ type: 'corp' } as any, 'user-1')).rejects.toThrow(
      'Business already registered',
    );
    expect(alerts.notify).not.toHaveBeenCalled();
  });
});
