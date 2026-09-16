import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AdminService, maskBizNumber, maskEmail, maskReporterName } from './admin.service.js';

/**
 * Auto-chaining thenable stand-in for a drizzle query builder: every method
 * call returns the proxy itself and awaiting it resolves the scripted value.
 * `spies` captures method args (e.g. `set`/`values`) for assertions.
 */
function chainable(resolved: unknown, spies: Record<string, (args: unknown[]) => void> = {}) {
  const proxy: any = new Proxy(function () {}, {
    get(_target, prop) {
      if (prop === 'then') {
        return (onFulfilled: (value: unknown) => unknown) => onFulfilled(resolved);
      }
      return (...args: unknown[]) => {
        spies[prop as string]?.(args);
        return proxy;
      };
    },
  });
  return proxy;
}

/** Scripted drizzle stub: each db.select()/update()/insert() pops the next queued result. */
function createDbStub(
  options: { select?: unknown[]; update?: unknown[]; insert?: unknown[] } = {},
) {
  const selectQueue = [...(options.select ?? [])];
  const updateQueue = [...(options.update ?? [])];
  const insertQueue = [...(options.insert ?? [])];
  const setCalls: unknown[][] = [];
  const valuesCalls: unknown[][] = [];
  const db: any = {
    select: vi.fn(() => chainable(selectQueue.length ? selectQueue.shift() : [])),
    update: vi.fn(() =>
      chainable(updateQueue.length ? updateQueue.shift() : [], {
        set: (args) => setCalls.push(args),
      }),
    ),
    insert: vi.fn(() =>
      chainable(insertQueue.length ? insertQueue.shift() : [], {
        values: (args) => valuesCalls.push(args),
      }),
    ),
  };
  return { db, setCalls, valuesCalls };
}

function createNotificationsStub() {
  return { create: vi.fn().mockResolvedValue({}) };
}

function createService(db: any, notifications = createNotificationsStub()) {
  return { service: new AdminService(db, notifications as any), notifications };
}

const verificationRow = { id: 'v1', businessId: 'b1', status: 'pending' };
const businessRow = { id: 'b1', ownerUserId: 'owner-1' };
const reportRow = {
  id: 'r1',
  content: '2025 AI챌린지',
  targetType: 'challenge',
  org: '테스트기관',
  summary: '피싱 의심',
  detail: '상세 내용',
  reporterUserId: 'u1',
  reporterName: '김*아',
  status: 'open',
  createdAt: new Date('2026-09-14T00:00:00Z'),
};

describe('AdminService — verifications', () => {
  it('approve sets verification + business approved and notifies the owner', async () => {
    const updatedVerification = { ...verificationRow, status: 'approved' };
    const { db, setCalls } = createDbStub({
      select: [[verificationRow], [businessRow]],
      update: [[updatedVerification], []],
    });
    const { service, notifications } = createService(db);

    const result = await service.approveVerification('v1');

    expect(result).toEqual(updatedVerification);
    expect(setCalls[0]).toEqual([
      expect.objectContaining({ status: 'approved', updatedAt: expect.any(Date) }),
    ]);
    expect(setCalls[1]).toEqual([{ verificationStatus: 'approved' }]);
    expect(notifications.create).toHaveBeenCalledWith('owner-1', 'verification.result', {
      verificationId: 'v1',
      status: 'approved',
    });
  });

  it('reject records the reason, rejects the business and notifies the owner', async () => {
    const updatedVerification = {
      ...verificationRow,
      status: 'rejected',
      rejectionReason: '서류 불일치',
    };
    const { db, setCalls } = createDbStub({
      select: [[verificationRow], [businessRow]],
      update: [[updatedVerification], []],
    });
    const { service, notifications } = createService(db);

    const result = await service.rejectVerification('v1', '서류 불일치');

    expect(result).toEqual(updatedVerification);
    expect(setCalls[0]).toEqual([
      expect.objectContaining({
        status: 'rejected',
        rejectionReason: '서류 불일치',
        updatedAt: expect.any(Date),
      }),
    ]);
    expect(setCalls[1]).toEqual([{ verificationStatus: 'rejected' }]);
    expect(notifications.create).toHaveBeenCalledWith('owner-1', 'verification.result', {
      verificationId: 'v1',
      status: 'rejected',
    });
  });

  it('throws NotFound for an unknown verification', async () => {
    const { db } = createDbStub({ select: [[]] });
    const { service } = createService(db);

    await expect(service.approveVerification('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('AdminService — certificates', () => {
  const certificateRow = {
    id: 'c1',
    userId: 'u1',
    title: '2025 공공데이터 활용 대회 대상',
    category: 'award',
    fileId: 'f1',
    status: 'pending',
  };

  it('approve verifies the certificate and appends a new badge', async () => {
    const updated = { ...certificateRow, status: 'verified' };
    const owner = { id: 'u1', name: '김수아', badges: ['기존 뱃지'] };
    const { db, setCalls } = createDbStub({
      select: [[certificateRow], [owner]],
      update: [[updated], []],
    });
    const { service } = createService(db);

    const result = await service.verifyCertificate('c1', { action: 'approve' });

    expect(result).toEqual({
      id: 'c1',
      user: '김수아',
      award: certificateRow.title,
      category: 'award',
      fileId: 'f1',
      status: 'verified',
    });
    expect(setCalls[1]).toEqual([{ badges: ['기존 뱃지', certificateRow.title] }]);
  });

  it('approve does not duplicate an existing badge', async () => {
    const updated = { ...certificateRow, status: 'verified' };
    const owner = { id: 'u1', name: '김수아', badges: [certificateRow.title] };
    const { db, setCalls } = createDbStub({
      select: [[certificateRow], [owner]],
      update: [[updated], []],
    });
    const { service } = createService(db);

    await service.verifyCertificate('c1', { action: 'approve' });

    expect(db.update).toHaveBeenCalledTimes(1);
    expect(setCalls).toHaveLength(1);
  });

  it('reject stores the rejection reason', async () => {
    const updated = { ...certificateRow, status: 'rejected', rejectionReason: '이미지 훼손' };
    const owner = { id: 'u1', name: '김수아', badges: [] };
    const { db, setCalls } = createDbStub({
      select: [[certificateRow], [owner]],
      update: [[updated], []],
    });
    const { service } = createService(db);

    const result = await service.verifyCertificate('c1', {
      action: 'reject',
      reason: '이미지 훼손',
    });

    expect(result.status).toBe('rejected');
    expect(setCalls[0]).toEqual([
      expect.objectContaining({ status: 'rejected', rejectionReason: '이미지 훼손' }),
    ]);
    expect(db.update).toHaveBeenCalledTimes(1);
  });
});

describe('AdminService — users', () => {
  it('suspend sets status/reason/at and returns the masked entry', async () => {
    const userRow = {
      id: 'u1',
      name: '김수아',
      email: 'kim.dev@gmail.com',
      position: null,
      status: 'suspended',
    };
    const { db, setCalls } = createDbStub({
      select: [[userRow], [{ count: 3 }]],
      update: [[]],
    });
    const { service } = createService(db);

    const result = await service.suspendUser('u1', { suspended: true, reason: 'spam' });

    expect(setCalls[0]).toEqual([
      expect.objectContaining({
        status: 'suspended',
        suspendedReason: 'spam',
        suspendedAt: expect.any(Date),
      }),
    ]);
    expect(result).toEqual({
      id: 'u1',
      name: '김수아',
      email: 'k***@gmail.com',
      position: '',
      reports: 3,
      status: 'suspended',
    });
  });

  it('lift clears the suspension fields', async () => {
    const userRow = {
      id: 'u1',
      name: '김수아',
      email: 'kim.dev@gmail.com',
      position: '프론트엔드',
      status: 'active',
    };
    const { db, setCalls } = createDbStub({
      select: [[userRow], [{ count: 0 }]],
      update: [[]],
    });
    const { service } = createService(db);

    const result = await service.suspendUser('u1', { suspended: false });

    expect(setCalls[0]).toEqual([{ status: 'active', suspendedReason: null, suspendedAt: null }]);
    expect(result).toEqual({
      id: 'u1',
      name: '김수아',
      email: 'k***@gmail.com',
      position: '프론트엔드',
      reports: 0,
      status: 'active',
    });
  });
});

describe('AdminService — ad pricing', () => {
  const products = [
    { id: 'p1', placement: 'hero', dailyPrice: 1000 },
    { id: 'p2', placement: 'gallery', dailyPrice: 2000 },
    { id: 'p3', placement: 'team', dailyPrice: 3000 },
  ];

  it('PUT updates by slot and returns the fresh pricing list', async () => {
    const updatedProducts = [
      { id: 'p1', placement: 'hero', dailyPrice: 5000 },
      { id: 'p2', placement: 'gallery', dailyPrice: 2000 },
      { id: 'p3', placement: 'team', dailyPrice: 7000 },
    ];
    const { db, setCalls } = createDbStub({
      // initial product lookup, then getAdPricing re-reads the updated rows
      select: [products, updatedProducts, [], [], []],
      update: [[], []],
    });
    const { service } = createService(db);

    const result = await service.updateAdPricing([
      { slot: 'hero', dailyPrice: 5000 },
      { slot: 'team', dailyPrice: 7000 },
    ]);

    expect(setCalls[0]).toEqual([{ dailyPrice: 5000 }]);
    expect(setCalls[1]).toEqual([{ dailyPrice: 7000 }]);
    expect(result.map((row) => [row.slot, row.dailyPrice])).toEqual([
      ['hero', 5000],
      ['gallery', 2000],
      ['team', 7000],
    ]);
    expect(result.map((row) => row.currentAdId)).toEqual([null, null, null]);
  });

  it('PUT rejects an unknown slot with 400', async () => {
    const { db, setCalls } = createDbStub({ select: [products] });
    const { service } = createService(db);

    await expect(
      service.updateAdPricing([{ slot: 'moon' as never, dailyPrice: 1 }]),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(setCalls).toHaveLength(0);
  });
});

describe('AdminService — dashboard', () => {
  it('returns stat cards, honest-zero adRatio/traffic and latest reports', async () => {
    const { db } = createDbStub({
      select: [[{ count: 5 }], [{ count: 3 }], [{ count: 10 }], [{ count: 2 }], []],
    });
    const { service } = createService(db);

    const result = await service.getDashboard('7days');

    expect(result.stats.map((card) => card.value)).toEqual(['5', '3', '10', '2']);
    expect(result.adRatio).toEqual({ value: '0 ₩', ratio: 0 });
    expect(result.traffic.labels).toEqual(['1일', '2일', '3일', '4일', '5일', '6일', '7일']);
    expect(result.traffic.primary).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(result.traffic.secondary).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(result.reports).toEqual([]);
  });

  it('defaults to 12 month labels for the 1year range', async () => {
    const { db } = createDbStub({
      select: [[{ count: 0 }], [{ count: 0 }], [{ count: 0 }], [{ count: 0 }], []],
    });
    const { service } = createService(db);

    const result = await service.getDashboard();

    expect(result.traffic.labels).toHaveLength(12);
    expect(result.traffic.labels[0]).toBe('1월');
    expect(result.traffic.labels[11]).toBe('12월');
  });
});

describe('AdminService — reports', () => {
  it('resolve sets resolved + note + resolvedAt and maps the contract shape', async () => {
    const updated = { ...reportRow, status: 'resolved', note: '조치 완료' };
    const { db, setCalls } = createDbStub({ update: [[updated]] });
    const { service } = createService(db);

    const result = await service.resolveReport('r1', { action: 'resolve', note: '조치 완료' });

    expect(setCalls[0]).toEqual([
      expect.objectContaining({
        status: 'resolved',
        note: '조치 완료',
        resolvedAt: expect.any(Date),
      }),
    ]);
    expect(result).toEqual({
      id: 'r1',
      content: '2025 AI챌린지',
      targetType: 'challenge',
      org: '테스트기관',
      summary: '피싱 의심',
      detail: '상세 내용',
      reporter: '김*아',
      reportedAt: reportRow.createdAt,
      status: 'resolved',
    });
  });

  it('dismiss sets dismissed with a null note when omitted', async () => {
    const updated = { ...reportRow, status: 'dismissed', note: null };
    const { db, setCalls } = createDbStub({ update: [[updated]] });
    const { service } = createService(db);

    const result = await service.resolveReport('r1', { action: 'dismiss' });

    expect(setCalls[0]).toEqual([expect.objectContaining({ status: 'dismissed', note: null })]);
    expect(result.status).toBe('dismissed');
  });

  it('throws NotFound when no report row was updated', async () => {
    const { db } = createDbStub({ update: [[]] });
    const { service } = createService(db);

    await expect(service.resolveReport('missing', { action: 'resolve' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('AdminService — user-facing masking', () => {
  it('masks emails to first char + *** + domain', () => {
    expect(maskEmail('kim.dev@gmail.com')).toBe('k***@gmail.com');
    expect(maskEmail('a@semochal.kr')).toBe('a***@semochal.kr');
  });

  it('masks reporter names', () => {
    expect(maskReporterName('김수아')).toBe('김*아');
    expect(maskReporterName('김아')).toBe('김*');
  });

  it('masks business numbers to the first 6 chars', () => {
    expect(maskBizNumber('123-45-67890')).toBe('123-45-*****');
  });

  it('createReport stores the masked reporter name and returns the contract row', async () => {
    const created = {
      ...reportRow,
      reporterName: '김*아',
      createdAt: new Date('2026-09-14T00:00:00Z'),
    };
    const { db, valuesCalls } = createDbStub({ insert: [[created]] });
    const { service } = createService(db);

    const result = await service.createReport(
      {
        content: '2025 AI챌린지',
        targetType: 'challenge',
        org: '테스트기관',
        summary: '피싱 의심',
        detail: '상세 내용',
      },
      { id: 'u1', email: 'kim.dev@gmail.com', name: '김수아', role: 'user' },
    );

    expect(valuesCalls[0]).toEqual([
      expect.objectContaining({ reporterUserId: 'u1', reporterName: '김*아' }),
    ]);
    expect(result.reporter).toBe('김*아');
  });
});

describe('AdminService — analytics', () => {
  it('resolves ?ad=N to the Nth ad ordered by createdAt', async () => {
    const adRow = (id: string, paidAmount: number) => ({
      ad: {
        id,
        startDate: new Date('2026-08-24T00:00:00Z'),
        endDate: new Date('2026-09-24T00:00:00Z'),
        paidAmount,
      },
      organization: '부산광역시',
    });
    const { db } = createDbStub({
      select: [
        [{ count: 7 }],
        [{ count: 4 }],
        [{ total: 300 }],
        [], // uuid lookup misses
        [adRow('ad-1', 100), adRow('ad-2', 250)], // integer path: all ads
      ],
    });
    const { service } = createService(db);

    const result = await service.getAnalytics('2');

    expect(result.stats.map((card) => card.value)).toEqual(['7', '4', '300']);
    expect(result.activity.yMax).toBe(10);
    expect(result.activity.general).toEqual([0, 0, 0, 0, 0, 0]);
    expect(result.adReport).toMatchObject({
      adNumber: 2,
      organization: '부산광역시',
      period: '8/24~9/24',
      daily: [],
    });
    expect(result.adReport?.stats.map((card) => card.value)).toEqual(['0', '0', '0%', '250']);
  });
});
