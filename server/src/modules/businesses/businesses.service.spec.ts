import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

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
    const service = new BusinessesService(
      db,
      { notify: vi.fn() } as any,
      { resolvePublicUrls: vi.fn(async () => new Map()) } as any,
      {} as any,
    );

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
    const service = new BusinessesService(
      db,
      { notify: vi.fn() } as any,
      { resolvePublicUrls: vi.fn(async () => new Map()) } as any,
      {} as any,
    );

    await expect(service.update('biz-2', { name: '새 이름' }, 'user-1')).rejects.toThrow(
      '기업 정보를 찾을 수 없거나 조회 권한이 없습니다.',
    );
  });
});

describe('BusinessesService.findById access control', () => {
  const owner = { id: 'user-1', email: 'o@x.com', name: 'Owner', role: 'user' };
  const admin = { id: 'admin-1', email: 'a@x.com', name: 'Admin', role: 'admin' };
  const stranger = { id: 'user-2', email: 's@x.com', name: 'Stranger', role: 'user' };

  function createFindDb(row: Record<string, unknown> | undefined) {
    const db: any = {
      select: () => ({
        from: () => ({ where: () => ({ limit: async () => (row ? [row] : []) }) }),
      }),
    };
    return db;
  }

  const businessRow = {
    id: 'biz-1',
    ownerUserId: owner.id,
    registrationNumber: '123-45-67890',
    verificationStatus: 'pending',
  };

  it('serves the full row to the owner', async () => {
    const service = new BusinessesService(
      createFindDb(businessRow),
      { notify: vi.fn() } as any,
      { resolvePublicUrls: vi.fn(async () => new Map()) } as any,
      {} as any,
    );
    await expect(service.findById('biz-1', owner)).resolves.toMatchObject({
      id: 'biz-1',
      registrationNumber: '123-45-67890',
      displayStatus: '가승인',
    });
  });

  it('serves the full row to an admin', async () => {
    const service = new BusinessesService(
      createFindDb(businessRow),
      { notify: vi.fn() } as any,
      { resolvePublicUrls: vi.fn(async () => new Map()) } as any,
      {} as any,
    );
    await expect(service.findById('biz-1', admin)).resolves.toMatchObject({ id: 'biz-1' });
  });

  it('forbids any other authenticated user from reading the sensitive row', async () => {
    const service = new BusinessesService(
      createFindDb(businessRow),
      { notify: vi.fn() } as any,
      { resolvePublicUrls: vi.fn(async () => new Map()) } as any,
      {} as any,
    );
    await expect(service.findById('biz-1', stranger)).rejects.toThrow(ForbiddenException);
  });

  it('returns 404 for a missing business regardless of the caller', async () => {
    const service = new BusinessesService(
      createFindDb(undefined),
      { notify: vi.fn() } as any,
      { resolvePublicUrls: vi.fn(async () => new Map()) } as any,
      {} as any,
    );
    await expect(service.findById('biz-x', admin)).rejects.toThrow(NotFoundException);
  });
});

describe('BusinessesService.listMyChallenges pagination', () => {
  function createListDb(rows: unknown[], limit: ReturnType<typeof vi.fn>) {
    const db: any = {
      select: () => ({
        from: () => ({
          innerJoin: () => ({
            where: () => ({
              orderBy: () => ({ limit }),
            }),
          }),
        }),
      }),
    };
    return db;
  }

  const challengeRow = (id: string) => ({
    challenge: { id, createdAt: new Date('2026-10-01T00:00:00.000Z') },
  });

  it('rejects an unparsable cursor with 400 before querying', async () => {
    const limit = vi.fn();
    const service = new BusinessesService(
      createListDb([], limit),
      { notify: vi.fn() } as any,
      { resolvePublicUrls: vi.fn(async () => new Map()) } as any,
      {} as any,
    );

    await expect(service.listMyChallenges('user-1', 'not-a-date', 20)).rejects.toThrow(
      BadRequestException,
    );
    expect(limit).not.toHaveBeenCalled();
  });

  it('clamps a NaN/invalid limit to the default for LIMIT, slice, and hasMore', async () => {
    const limit = vi.fn().mockResolvedValue([challengeRow('c-1')]);
    const service = new BusinessesService(
      createListDb([], limit),
      { notify: vi.fn() } as any,
      { resolvePublicUrls: vi.fn(async () => new Map()) } as any,
      {} as any,
    );

    const result = await service.listMyChallenges('user-1', undefined, Number('abc'));

    expect(limit).toHaveBeenCalledWith(21); // 기본 20 + hasMore 판정용 1행
    expect(result.items).toHaveLength(1);
    expect(result.nextCursor).toBeNull();
  });

  it('clamps an oversized limit to 100 for LIMIT, slice, and hasMore', async () => {
    const many = Array.from({ length: 101 }, (_, i) => challengeRow(`c-${i}`));
    const limit = vi.fn().mockResolvedValue(many);
    const service = new BusinessesService(
      createListDb([], limit),
      { notify: vi.fn() } as any,
      { resolvePublicUrls: vi.fn(async () => new Map()) } as any,
      {} as any,
    );

    const result = await service.listMyChallenges('user-1', undefined, 5000);

    expect(limit).toHaveBeenCalledWith(101);
    expect(result.items).toHaveLength(100);
    expect(result.nextCursor).toBe('2026-10-01T00:00:00.000Z');
  });
});

describe('BusinessesService.register', () => {
  function createRegisterDb(existing: unknown[]) {
    const created = { id: 'biz-new', verificationStatus: 'verified', ownerUserId: 'user-1' };
    const inserted: Record<string, unknown>[] = [];
    const tx: any = {
      insert: () => ({
        values: (values: Record<string, unknown>) => {
          inserted.push(values);
          return { returning: async () => [created] };
        },
      }),
      update: () => ({ set: () => ({ where: async () => [] }) }),
    };
    const db: any = {
      select: () => ({ from: () => ({ where: () => ({ limit: async () => existing }) }) }),
      transaction: async (callback: (tx: unknown) => unknown) => callback(tx),
      inserted,
    };
    return db;
  }

  it.each(['registered', 'unavailable'])('allows a company when lookup is %s', async (result) => {
    const db = createRegisterDb([]);
    const lookupRegistration =
      result === 'unavailable'
        ? vi.fn().mockRejectedValue(new Error('offline'))
        : vi.fn().mockResolvedValue(result);
    const service = new BusinessesService(
      db,
      { notify: vi.fn() } as any,
      {} as any,
      { lookupRegistration } as any,
    );
    await expect(
      service.register({ type: '기업', registrationNumber: '1234567890' }, 'user-1'),
    ).resolves.toMatchObject({ registrationLookupUnavailable: result === 'unavailable' });
    // 자동 승인으로 생성되며, 국세청 조회 결과가 기관에 기록된다.
    expect(db.inserted[0]).toMatchObject({ verificationStatus: 'verified', ntsResult: result });
  });

  it('does not record an NTS result for organizations that are not looked up', async () => {
    const db = createRegisterDb([]);
    const lookupRegistration = vi.fn();
    const service = new BusinessesService(
      db,
      { notify: vi.fn() } as any,
      {} as any,
      { lookupRegistration } as any,
    );
    await service.register({ type: '학교' }, 'user-1');
    expect(lookupRegistration).not.toHaveBeenCalled();
    expect(db.inserted[0]).toMatchObject({ verificationStatus: 'verified', ntsResult: null });
  });

  it('rejects unregistered or missing company numbers before creating a business', async () => {
    const db = createRegisterDb([]);
    const transaction = vi.spyOn(db, 'transaction');
    const service = new BusinessesService(
      db,
      { notify: vi.fn() } as any,
      {} as any,
      { lookupRegistration: vi.fn().mockResolvedValue('unregistered') } as any,
    );
    await expect(
      service.register({ type: '기업', registrationNumber: '1234567890' }, 'user-1'),
    ).rejects.toThrow('국세청에 등록되지 않은');
    await expect(service.register({ type: '기업' }, 'user-1')).rejects.toThrow(BadRequestException);
    expect(transaction).not.toHaveBeenCalled();
  });

  it.each(['학교', '비영리', '협회'] as const)(
    'allows %s without a registration number',
    async (type) => {
      const lookupRegistration = vi.fn();
      const service = new BusinessesService(
        createRegisterDb([]),
        { notify: vi.fn() } as any,
        {} as any,
        { lookupRegistration } as any,
      );
      await expect(service.register({ type }, 'user-1')).resolves.toMatchObject({ id: 'biz-new' });
      expect(lookupRegistration).not.toHaveBeenCalled();
    },
  );

  it('raises the newBusinessAlert admin alert with the business id only', async () => {
    const alerts = { notify: vi.fn().mockResolvedValue(undefined) };
    const service = new BusinessesService(
      createRegisterDb([]),
      alerts as any,
      {} as any,
      {} as any,
    );

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
    const service = new BusinessesService(
      createRegisterDb([{ id: 'biz-old' }]),
      alerts as any,
      {} as any,
      {} as any,
    );

    await expect(service.register({ type: 'corp' } as any, 'user-1')).rejects.toThrow(
      '이미 등록된 기업 정보가 있습니다.',
    );
    expect(alerts.notify).not.toHaveBeenCalled();
  });
});

describe('BusinessesService.findPublicById', () => {
  const publicRow = {
    id: 'biz-1',
    name: '주식회사 새모',
    type: '기업',
    verificationStatus: 'verified',
    bannerImageFileId: 'file-banner',
    logoImageFileId: 'file-logo',
    address: '서울시 강남구',
    phone: '02-1234-5678',
    email: 'biz@semochal.kr',
    contentBlocks: [],
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  function createPublicDb(row: Record<string, unknown> | undefined) {
    const db: any = {
      select: () => ({
        from: () => ({ where: () => ({ limit: async () => (row ? [row] : []) }) }),
      }),
    };
    return db;
  }

  function createService(row: Record<string, unknown> | undefined, resolvePublicUrls = vi.fn()) {
    return new BusinessesService(
      createPublicDb(row),
      { notify: vi.fn() } as any,
      { resolvePublicUrls } as any,
      {} as any,
    );
  }

  it('returns public fields with resolved banner/logo URLs and hides sensitive ones', async () => {
    const resolvePublicUrls = vi.fn(
      async () =>
        new Map([
          ['file-banner', 'https://cdn.example.com/banner.png'],
          ['file-logo', 'https://cdn.example.com/logo.png'],
        ]),
    );
    const service = createService(publicRow, resolvePublicUrls);

    const result = await service.findPublicById('biz-1');

    expect(result).toEqual({
      id: 'biz-1',
      name: '주식회사 새모',
      type: '기업',
      address: '서울시 강남구',
      phone: '02-1234-5678',
      email: 'biz@semochal.kr',
      contentBlocks: [],
      createdAt: publicRow.createdAt,
      bannerUrl: 'https://cdn.example.com/banner.png',
      logoUrl: 'https://cdn.example.com/logo.png',
      displayStatus: '승인',
      detailStatus: '승인',
    });
    // 사업자등록번호·소유자 ID·nts 결과·원본 파일 ID는 비로그인 응답에 포함되면 안 된다.
    expect(result).not.toHaveProperty('registrationNumber');
    expect(result).not.toHaveProperty('ownerUserId');
    expect(result).not.toHaveProperty('ntsResult');
    expect(result).not.toHaveProperty('registrationLookupUnavailable');
    expect(result).not.toHaveProperty('bannerImageFileId');
    expect(result).not.toHaveProperty('logoImageFileId');
    expect(resolvePublicUrls).toHaveBeenCalledWith(['file-banner', 'file-logo']);
  });

  it('resolves banner/logo to null when the business has none', async () => {
    const service = createService({ ...publicRow, bannerImageFileId: null, logoImageFileId: null });
    const result = await service.findPublicById('biz-1');
    expect(result.bannerUrl).toBeNull();
    expect(result.logoUrl).toBeNull();
  });

  it('throws NotFound for a missing business', async () => {
    const service = createService(undefined);
    await expect(service.findPublicById('biz-x')).rejects.toThrow(NotFoundException);
  });
});
