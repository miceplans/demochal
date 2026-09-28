import { BadRequestException, NotFoundException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ads,
  applications,
  businesses,
  certificates,
  orders,
  payments,
  reports,
  users,
} from '../../db/schema.js';
import { AdminService, maskBizNumber, maskEmail, niceMax, timeBuckets } from './admin.service.js';
import { DEFAULT_VALUES, SETTINGS_GROUPS } from './admin-settings.service.js';

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
  const selectWhereCalls: unknown[][] = [];
  const db: any = {
    select: vi.fn(() =>
      chainable(selectQueue.length ? selectQueue.shift() : [], {
        where: (args) => selectWhereCalls.push(args),
      }),
    ),
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
  return { db, setCalls, valuesCalls, selectWhereCalls };
}

/** drizzle SQL 트리에서 문자열 값(Param 포함)을 모은다. */
function collectStrings(node: any, acc: string[] = []): string[] {
  if (typeof node === 'string') {
    acc.push(node);
    return acc;
  }
  if (Array.isArray(node)) {
    node.forEach((c) => collectStrings(c, acc));
    return acc;
  }
  if (node?.constructor?.name === 'Param' && typeof node.value === 'string') {
    acc.push(node.value);
    return acc;
  }
  if (Array.isArray(node?.queryChunks)) {
    node.queryChunks.forEach((c: any) => collectStrings(c, acc));
  }
  return acc;
}

function createNotificationsStub() {
  return { create: vi.fn().mockResolvedValue({}) };
}

/** Does a drizzle SQL tree reference this exact column object (by identity)? */
function referencesColumn(node: any, target: unknown, seen = new Set<unknown>()): boolean {
  if (node === target) return true;
  if (!node || typeof node !== 'object' || seen.has(node)) return false;
  seen.add(node);
  if (Array.isArray(node)) return node.some((c) => referencesColumn(c, target, seen));
  if (Array.isArray(node.queryChunks)) return referencesColumn(node.queryChunks, target, seen);
  return false;
}

const zeroAdReport = {
  totals: { impressions: 0, clicks: 0, ctr: 0 },
  daily: [],
  hourly: [],
  monthlyClicks: [],
};

function createAdsStub(report: unknown = zeroAdReport) {
  return { getReportForAdmin: vi.fn().mockResolvedValue(report) };
}

function createFilesStub() {
  return {
    getPrivateReadUrl: vi.fn(async (key: string) => `https://signed.example/${key}`),
  };
}

function createService(
  db: any,
  notifications = createNotificationsStub(),
  adsService = createAdsStub(),
  files = createFilesStub(),
  settings = createSettingsStub(),
) {
  return {
    service: new AdminService(
      db,
      notifications as any,
      adsService as any,
      files as any,
      settings as any,
    ),
    notifications,
    adsService,
  };
}

function createSettingsStub(values: Record<string, boolean> = DEFAULT_VALUES) {
  return {
    get: vi.fn().mockResolvedValue({ groups: SETTINGS_GROUPS, values }),
    update: vi.fn().mockResolvedValue(values),
  };
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
  it('approve sets verification + business verified and notifies the owner', async () => {
    const updatedVerification = { ...verificationRow, status: 'verified' };
    const { db, setCalls } = createDbStub({
      select: [[verificationRow], [businessRow]],
      update: [[updatedVerification], []],
    });
    const { service, notifications } = createService(db);

    const result = await service.approveVerification('v1');

    expect(result).toEqual(updatedVerification);
    expect(setCalls[0]).toEqual([
      expect.objectContaining({ status: 'verified', updatedAt: expect.any(Date) }),
    ]);
    expect(setCalls[1]).toEqual([{ verificationStatus: 'verified' }]);
    expect(notifications.create).toHaveBeenCalledWith('owner-1', 'verification.result', {
      verificationId: 'v1',
      status: 'verified',
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

  it('reject without a reason is refused before touching the DB', async () => {
    const { db } = createDbStub();
    const { service } = createService(db);

    await expect(
      service.verifyCertificate('c1', { action: 'reject', reason: '  ' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(db.select).not.toHaveBeenCalled();
  });

  describe('list', () => {
    const base = {
      certificate: {
        id: 'c1',
        title: '대상',
        category: 'award',
        fileId: 'f1',
        status: 'pending',
      },
      userName: '김수아',
    };

    it('filters by category', async () => {
      const { db, selectWhereCalls } = createDbStub({ select: [[]] });
      const { service } = createService(db);

      await service.listCertificates('pending', undefined, 'participation');

      const where = selectWhereCalls[0]?.[0];
      expect(referencesColumn(where, certificates.category)).toBe(true);
      expect(collectStrings(where)).toContain('participation');
    });

    it('presigns private originals and never exposes a raw key', async () => {
      const privateFile = {
        id: 'f1',
        bucket: 'private',
        key: 'pending/f1.png',
        uploadStatus: 'ready',
        contentType: 'image/png',
      };
      const { db } = createDbStub({ select: [[{ ...base, file: privateFile }]] });
      const files = createFilesStub();
      const { service } = createService(db, createNotificationsStub(), undefined, files);

      const [row] = await service.listCertificates();

      expect(files.getPrivateReadUrl).toHaveBeenCalledWith('pending/f1.png');
      expect(row).toMatchObject({
        fileUrl: 'https://signed.example/pending/f1.png',
        fileContentType: 'image/png',
      });
    });

    it('returns no URL for a missing or unfinished upload', async () => {
      const pendingFile = {
        id: 'f1',
        bucket: 'private',
        key: 'pending/f1.png',
        uploadStatus: 'pending',
        contentType: 'image/png',
      };
      const { db } = createDbStub({
        select: [
          [
            { ...base, file: pendingFile },
            { ...base, file: null },
          ],
        ],
      });
      const files = createFilesStub();
      const { service } = createService(db, createNotificationsStub(), undefined, files);

      const rows = await service.listCertificates();

      expect(rows.map((row) => row.fileUrl)).toEqual([null, null]);
      expect(files.getPrivateReadUrl).not.toHaveBeenCalled();
    });
  });
});

describe('AdminService — contents', () => {
  const team = {
    id: 't1',
    title: '세모팀',
    openRoles: [
      { role: '프론트엔드', count: 1 },
      { role: '백엔드', count: 2 },
    ],
  };
  const challenge = {
    id: 'ch1',
    title: 'AI 챌린지',
    category: 'IT',
    endDate: new Date(Date.now() + 3 * 86_400_000),
  };

  it('splits filled vs open roles, flags open reports and returns section totals', async () => {
    const { db } = createDbStub({
      select: [
        [{ count: 12 }], // teams total
        [{ team, challengeTitle: 'AI 챌린지' }],
        [
          { teamId: 't1', role: '프론트엔드', count: 1 },
          { teamId: 't1', role: '백엔드', count: 1 },
        ],
        [{ count: 30 }], // challenges total
        [challenge],
        [{ challengeId: 'ch1', count: 1 }],
        [{ targetId: 'ch1' }], // open report on the challenge only
        [],
      ],
    });
    const { service } = createService(db);

    const result = await service.getContents();

    expect(result.teams).toEqual([
      {
        id: 't1',
        name: '세모팀',
        challenge: 'AI 챌린지',
        roles: ['프론트엔드'],
        otherRoles: ['백엔드'],
        members: '2/4명 참여중',
        unread: false,
      },
    ]);
    expect(result.contests[0]).toMatchObject({ id: 'ch1', teams: '팀 모집 1건', unread: true });
    expect(result.teamsTotal).toBe(12);
    expect(result.contestsTotal).toBe(30);
  });

  it('clamps section limits to 1..50 with a default page of 8', async () => {
    const limits: unknown[] = [];
    const db: any = {
      select: vi.fn(() => {
        const proxy: any = new Proxy(function () {}, {
          get(_target, prop) {
            if (prop === 'then') return (resolve: (value: unknown) => unknown) => resolve([]);
            return (...args: unknown[]) => {
              if (prop === 'limit') limits.push(args[0]);
              return proxy;
            };
          },
        });
        return proxy;
      }),
    };
    const { service } = createService(db);

    await service.getContents('500', 'abc');

    // teams, challenges, then the fixed 5-row report log.
    expect(limits).toEqual([50, 8, 5]);
  });
});

describe('AdminService — users', () => {
  it('suspend sets suspended/reason/at and returns the masked entry', async () => {
    const userRow = {
      id: 'u1',
      name: '김수아',
      email: 'kim.dev@gmail.com',
      position: null,
      suspended: true,
      suspendedReason: 'spam',
    };
    const { db, setCalls } = createDbStub({
      select: [[{ reportedUserId: 'u1', count: 3 }]],
      update: [[userRow]],
    });
    const { service } = createService(db);

    const result = await service.suspendUser('u1', { suspended: true, reason: 'spam' });

    expect(setCalls[0]).toEqual([
      expect.objectContaining({
        suspended: true,
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
      suspendedReason: 'spam',
    });
  });

  it('lift clears the suspension fields', async () => {
    const userRow = {
      id: 'u1',
      name: '김수아',
      email: 'kim.dev@gmail.com',
      position: '프론트엔드',
      suspended: false,
      suspendedReason: null,
    };
    const { db, setCalls } = createDbStub({
      select: [[]],
      update: [[userRow]],
    });
    const { service } = createService(db);

    const result = await service.suspendUser('u1', { suspended: false });

    expect(setCalls[0]).toEqual([{ suspended: false, suspendedReason: null, suspendedAt: null }]);
    expect(result).toEqual({
      id: 'u1',
      name: '김수아',
      email: 'k***@gmail.com',
      position: '프론트엔드',
      reports: 0,
      status: 'active',
      suspendedReason: null,
    });
  });

  it('suspend throws NotFound when no user row was updated', async () => {
    const { db } = createDbStub({ update: [[]] });
    const { service } = createService(db);

    await expect(service.suspendUser('missing', { suspended: true })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('list counts reports filed against each user (reportedUserId), not by them', async () => {
    const rows = [
      { id: 'u1', name: '김수아', email: 'kim@a.com', position: '백엔드', suspended: false },
      { id: 'u2', name: '이도윤', email: 'lee@a.com', position: null, suspended: true },
    ];
    const { db, selectWhereCalls } = createDbStub({
      select: [rows, [{ reportedUserId: 'u2', count: 4 }]],
    });
    const { service } = createService(db);

    const result = await service.listUsers();

    expect(result.map((row) => [row.id, row.reports, row.status])).toEqual([
      ['u1', 0, 'active'],
      ['u2', 4, 'suspended'],
    ]);
    const countWhere = selectWhereCalls[1]?.[0];
    expect(referencesColumn(countWhere, reports.reportedUserId)).toBe(true);
    expect(referencesColumn(countWhere, reports.reporterUserId)).toBe(false);
  });

  it('list applies joinedWithin and position filters', async () => {
    const { db, selectWhereCalls } = createDbStub({ select: [[]] });
    const { service } = createService(db);

    await service.listUsers(undefined, undefined, '30d', '프론트엔드');

    const where = selectWhereCalls[0]?.[0];
    expect(referencesColumn(where, users.createdAt)).toBe(true);
    expect(referencesColumn(where, users.position)).toBe(true);
    expect(collectStrings(where)).toContain('%프론트엔드%');
    // No users → the report-count query is skipped entirely.
    expect(db.select).toHaveBeenCalledTimes(1);
  });

  it('list ignores an unknown joinedWithin value', async () => {
    const { db, selectWhereCalls } = createDbStub({ select: [[]] });
    const { service } = createService(db);

    await service.listUsers(undefined, undefined, 'forever');

    expect(selectWhereCalls[0]?.[0]).toBeUndefined();
  });
});

describe('AdminService — businesses', () => {
  const businessRow = {
    id: 'b1',
    name: '세모재단',
    type: '비영리' as string | null,
    registrationNumber: '123-45-67890',
    verificationStatus: 'pending',
    createdAt: new Date('2026-09-01T00:00:00Z'),
  };
  const statCounts = [[{ count: 1 }], [{ count: 0 }], [{ count: 0 }], [{ count: 1 }]];

  it('filters by businesses.type and returns the stored type', async () => {
    const { db, selectWhereCalls } = createDbStub({
      select: [...statCounts, [businessRow], []],
    });
    const { service } = createService(db);

    const result = await service.listBusinesses(undefined, '비영리');

    const listWhere = selectWhereCalls[3]?.[0];
    expect(referencesColumn(listWhere, businesses.type)).toBe(true);
    expect(collectStrings(listWhere)).toContain('비영리');
    expect(result.items[0]?.type).toBe('비영리');
  });

  it("falls back to '미지정' when a business has no type", async () => {
    const { db } = createDbStub({
      select: [...statCounts, [{ ...businessRow, type: null }], []],
    });
    const { service } = createService(db);

    const result = await service.listBusinesses();

    expect(result.items[0]?.type).toBe('미지정');
  });

  it('returns the latest verification id so approve/reject target the request, not the business', async () => {
    const { db } = createDbStub({
      select: [
        ...statCounts,
        [businessRow, { ...businessRow, id: 'b2' }],
        // desc(createdAt): v-new is the latest for b1; b2 has none.
        [
          { id: 'v-new', businessId: 'b1', status: 'pending', ocrResult: null },
          { id: 'v-old', businessId: 'b1', status: 'rejected', ocrResult: null },
        ],
      ],
    });
    const { service } = createService(db);

    const result = await service.listBusinesses();

    expect(result.items.map((item) => [item.id, item.verificationId])).toEqual([
      ['b1', 'v-new'],
      ['b2', null],
    ]);
  });

  it("counts '승인' and filters by the canonical verified status", async () => {
    const { db, selectWhereCalls } = createDbStub({ select: [...statCounts, [], []] });
    const { service } = createService(db);

    await service.listBusinesses(undefined, undefined, 'verified');

    // [0] 승인 count, [1] 거부, [2] 대기, [3] list filter
    expect(collectStrings(selectWhereCalls[0]?.[0])).toContain('verified');
    expect(collectStrings(selectWhereCalls[3]?.[0])).toContain('verified');
  });

  it('marks NTS success from a verified verification row', async () => {
    const { db } = createDbStub({
      select: [
        ...statCounts,
        [{ ...businessRow, verificationStatus: 'verified' }],
        [{ id: 'v1', businessId: 'b1', status: 'verified', ocrResult: null }],
      ],
    });
    const { service } = createService(db);

    const result = await service.listBusinesses();

    expect(result.items[0]).toMatchObject({ nts: 'success', status: 'verified' });
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

describe('AdminService — ads list', () => {
  const adRow = { id: 'ad-1', title: '2026 AI 챌린지 광고', status: 'active', paidAmount: 300000 };

  it('joins the organization name and product name onto each ad row', async () => {
    const { db } = createDbStub({
      select: [[{ ad: adRow, organization: '부산광역시', productName: '홈 배너' }]],
    });
    const { service } = createService(db);

    const result = await service.listAds();

    expect(result).toEqual([{ ...adRow, organization: '부산광역시', productName: '홈 배너' }]);
  });

  it('matches q against both the ad title and the business name', async () => {
    const { db, selectWhereCalls } = createDbStub({ select: [[]] });
    const { service } = createService(db);

    await service.listAds('부산');

    const where = selectWhereCalls[0];
    expect(collectStrings(where)).toContain('%부산%');
    expect(referencesColumn(where, ads.title)).toBe(true);
    expect(referencesColumn(where, businesses.name)).toBe(true);
  });

  it('filters by the exact status value', async () => {
    const { db, selectWhereCalls } = createDbStub({ select: [[]] });
    const { service } = createService(db);

    await service.listAds(undefined, 'paused');

    const where = selectWhereCalls[0];
    expect(collectStrings(where)).toContain('paused');
    expect(referencesColumn(where, ads.status)).toBe(true);
    expect(referencesColumn(where, ads.title)).toBe(false);
  });

  it('combines q and status into a single where clause', async () => {
    const { db, selectWhereCalls } = createDbStub({ select: [[]] });
    const { service } = createService(db);

    await service.listAds('부산', 'active');

    const where = selectWhereCalls[0];
    const strings = collectStrings(where);
    expect(strings).toContain('%부산%');
    expect(strings).toContain('active');
    expect(referencesColumn(where, ads.title)).toBe(true);
    expect(referencesColumn(where, businesses.name)).toBe(true);
    expect(referencesColumn(where, ads.status)).toBe(true);
  });

  it('skips the where clause entirely when no filter is given', async () => {
    const { db, selectWhereCalls } = createDbStub({ select: [[]] });
    const { service } = createService(db);

    await service.listAds();

    expect(selectWhereCalls).toHaveLength(1);
    expect(selectWhereCalls[0]?.[0]).toBeUndefined();
  });
});

describe('AdminService — time buckets', () => {
  const now = new Date('2026-09-23T10:00:00Z');

  it('builds consecutive day buckets ending today', () => {
    const buckets = timeBuckets('day', 3, now);
    expect(buckets.keys).toEqual(['2026-09-21', '2026-09-22', '2026-09-23']);
    expect(buckets.labels).toEqual(['9/21', '9/22', '9/23']);
    expect(buckets.since.toISOString()).toBe('2026-09-21T00:00:00.000Z');
  });

  it('builds month buckets across a year boundary', () => {
    const buckets = timeBuckets('month', 12, now);
    expect(buckets.keys[0]).toBe('2025-10-01');
    expect(buckets.keys[11]).toBe('2026-09-01');
    expect(buckets.labels[0]).toBe('10월');
    expect(buckets.labels[11]).toBe('9월');
  });

  it('rounds chart maxima up to 1/2/5 steps with a floor of 10', () => {
    expect(niceMax(0)).toBe(10);
    expect(niceMax(7)).toBe(10);
    expect(niceMax(11)).toBe(20);
    expect(niceMax(37)).toBe(50);
    expect(niceMax(120)).toBe(200);
  });
});

describe('AdminService — dashboard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-23T10:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('fills traffic buckets from user signups and application submissions and computes the ad revenue share', async () => {
    const { db, selectWhereCalls } = createDbStub({
      select: [
        [{ count: 5 }],
        [{ count: 3 }],
        [{ count: 10 }],
        [{ count: 2 }],
        [],
        [
          { bucket: '2026-09-17', count: 4 },
          { bucket: '2026-09-23', count: 1 },
        ],
        [{ bucket: '2026-09-23', count: 2 }],
        [{ total: 40_000, ad: 10_000 }],
      ],
    });
    const { service } = createService(db);

    const result = await service.getDashboard('7days');

    expect(result.stats.map((card) => card.value)).toEqual(['5', '3', '10', '2']);
    expect(result.traffic.labels).toEqual(['9/17', '9/18', '9/19', '9/20', '9/21', '9/22', '9/23']);
    expect(result.traffic.primary).toEqual([4, 0, 0, 0, 0, 0, 1]);
    expect(result.traffic.secondary).toEqual([0, 0, 0, 0, 0, 0, 2]);
    expect(result.adRatio).toEqual({ value: '10,000 ₩', ratio: 0.25 });
    expect(result.generatedAt).toBe('2026-09-23T10:00:00.000Z');

    // Traffic: primary는 일반 사용자(user) 신규 가입, secondary는 신규 제출물(applications).
    const signupSelect = db.select.mock.calls[5]![0];
    expect(referencesColumn(signupSelect.bucket, users.createdAt)).toBe(true);
    expect(collectStrings(selectWhereCalls[3])).toContain('user');
    const submissionSelect = db.select.mock.calls[6]![0];
    expect(referencesColumn(submissionSelect.bucket, applications.createdAt)).toBe(true);

    // Revenue is scoped to completed payments (paid + legacy done) within the
    // same window, and the ad share keys off orders.adId.
    const revenueSelect = db.select.mock.calls[7]![0];
    expect(referencesColumn(revenueSelect.ad, orders.adId)).toBe(true);
    expect(referencesColumn(revenueSelect.total, payments.refundedAmount)).toBe(true);
    const revenueWhere = selectWhereCalls[selectWhereCalls.length - 1];
    expect(collectStrings(revenueWhere)).toEqual(expect.arrayContaining(['paid', 'done']));
  });

  it('counts legacy done payments alongside paid in the ad revenue window', async () => {
    const { db, selectWhereCalls } = createDbStub({
      select: [
        [{ count: 0 }],
        [{ count: 0 }],
        [{ count: 0 }],
        [{ count: 0 }],
        [],
        [],
        [],
        [{ total: 50_000, ad: 20_000 }],
      ],
    });
    const { service } = createService(db);

    const result = await service.getDashboard('7days');

    expect(result.adRatio).toEqual({ value: '20,000 ₩', ratio: 0.4 });
    const revenueWhere = selectWhereCalls[selectWhereCalls.length - 1];
    expect(collectStrings(revenueWhere)).toEqual(expect.arrayContaining(['paid', 'done']));
  });

  it('returns a zero ratio instead of dividing by zero when there is no revenue', async () => {
    const { db } = createDbStub({
      select: [[{ count: 0 }], [{ count: 0 }], [{ count: 0 }], [{ count: 0 }], [], [], [], []],
    });
    const { service } = createService(db);

    const result = await service.getDashboard('30days');

    expect(result.adRatio).toEqual({ value: '0 ₩', ratio: 0 });
    expect(result.traffic.labels).toHaveLength(30);
    expect(result.traffic.primary.every((value) => value === 0)).toBe(true);
  });

  it('defaults to 12 month buckets ending this month', async () => {
    const { db } = createDbStub({
      select: [[{ count: 0 }], [{ count: 0 }], [{ count: 0 }], [{ count: 0 }], [], [], [], []],
    });
    const { service } = createService(db);

    const result = await service.getDashboard();

    expect(result.traffic.labels).toHaveLength(12);
    expect(result.traffic.labels[0]).toBe('10월');
    expect(result.traffic.labels[11]).toBe('9월');
  });
});

describe('AdminService — reports', () => {
  it('applies status and target type filters when listing reports', async () => {
    const { db, selectWhereCalls } = createDbStub({ select: [[reportRow]] });
    const { service } = createService(db);

    const result = await service.listReports('피싱', 'open', 'challenge');

    expect(result).toHaveLength(1);
    expect(selectWhereCalls).toHaveLength(1);
    expect(referencesColumn(selectWhereCalls[0], reports.content)).toBe(true);
    expect(referencesColumn(selectWhereCalls[0], reports.status)).toBe(true);
    expect(referencesColumn(selectWhereCalls[0], reports.targetType)).toBe(true);
  });

  it('omits optional report filters when they are not provided', async () => {
    const { db, selectWhereCalls } = createDbStub({ select: [[reportRow]] });
    const { service } = createService(db);

    await service.listReports();

    expect(selectWhereCalls).toEqual([[undefined]]);
  });

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

  it('masks business numbers to the first 6 chars', () => {
    expect(maskBizNumber('123-45-67890')).toBe('123-45-*****');
  });
});

describe('AdminService — analytics', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-23T10:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const uuid = '11111111-1111-1111-1111-111111111111';
  const adRow = {
    ad: {
      id: uuid,
      adNumber: 7,
      startDate: new Date('2026-08-24T00:00:00Z'),
      endDate: new Date('2026-09-24T00:00:00Z'),
      paidAmount: 250,
    },
    organization: '부산광역시',
  };
  // users(30d), challenges(30d), payments, user signups/month, new businesses/month
  const baseSelects = () => [
    [{ count: 7 }],
    [{ count: 4 }],
    [{ total: 300 }],
    [
      { bucket: '2026-04-01', count: 3 },
      { bucket: '2026-09-01', count: 12 },
    ],
    [{ bucket: '2026-08-01', count: 2 }],
  ];

  it('counts new users/challenges over the last 30 days and fills monthly activity', async () => {
    const { db, selectWhereCalls } = createDbStub({ select: baseSelects() });
    const { service } = createService(db);

    const result = await service.getAnalytics();

    expect(result.stats.map((card) => [card.value, card.meta])).toEqual([
      ['7', '최근 30일'],
      ['4', '최근 30일'],
      ['300', '결제 완료 기준'],
    ]);
    // Both "신규" cards are windowed, not all-time totals.
    expect(selectWhereCalls[0]?.[0]).toBeDefined();
    expect(selectWhereCalls[1]?.[0]).toBeDefined();
    expect(result.activity.months).toEqual(['4월', '5월', '6월', '7월', '8월', '9월']);
    expect(result.activity.general).toEqual([3, 0, 0, 0, 0, 12]);
    expect(result.activity.corp).toEqual([0, 0, 0, 0, 2, 0]);
    expect(result.activity.yMax).toBe(20);
    expect(result.adReport).toBeUndefined();

    // Activity: general은 일반 사용자(user) 신규 가입, corp는 신규 기업(businesses) 가입.
    expect(referencesColumn(db.select.mock.calls[3]![0].bucket, users.createdAt)).toBe(true);
    expect(collectStrings(selectWhereCalls[3])).toContain('user');
    expect(referencesColumn(db.select.mock.calls[4]![0].bucket, businesses.createdAt)).toBe(true);
  });

  it('nets platform revenue against refundedAmount on paid and legacy done payments', async () => {
    const { db, selectWhereCalls } = createDbStub({ select: baseSelects() });
    const { service } = createService(db);

    await service.getAnalytics();

    const revenueSelectArg = db.select.mock.calls[2]![0];
    expect(referencesColumn(revenueSelectArg.total, payments.amount)).toBe(true);
    expect(referencesColumn(revenueSelectArg.total, payments.refundedAmount)).toBe(true);
    expect(collectStrings(selectWhereCalls[2])).toEqual(expect.arrayContaining(['paid', 'done']));
  });

  it('resolves ?ad=N by the stable ads.ad_number column, not list position', async () => {
    const { db, selectWhereCalls } = createDbStub({ select: [...baseSelects(), [adRow]] });
    const { service, adsService } = createService(db);

    const result = await service.getAnalytics('7');

    const adWhere = selectWhereCalls[selectWhereCalls.length - 1]?.[0];
    expect(referencesColumn(adWhere, ads.adNumber)).toBe(true);
    expect(referencesColumn(adWhere, ads.id)).toBe(false);
    expect(adsService.getReportForAdmin).toHaveBeenCalledWith(uuid);
    expect(result.adReport).toMatchObject({
      adId: uuid,
      adNumber: 7,
      organization: '부산광역시',
      period: '8/24~9/24',
      daily: [],
    });
    expect(result.adReport?.stats.map((card) => card.value)).toEqual(['0', '0', '0%', '250']);
  });

  it('resolves a uuid ?ad= via ads.id and passes through AdsService metrics', async () => {
    const report = {
      totals: { impressions: 1200, clicks: 36, ctr: 3 },
      daily: [{ date: '2026-09-22', impressions: 1200, clicks: 36, ctr: 3 }],
      hourly: [],
      monthlyClicks: [],
    };
    const { db, selectWhereCalls } = createDbStub({ select: [...baseSelects(), [adRow]] });
    const { service } = createService(db, createNotificationsStub(), createAdsStub(report));

    const result = await service.getAnalytics(uuid);

    const adWhere = selectWhereCalls[selectWhereCalls.length - 1]?.[0];
    expect(referencesColumn(adWhere, ads.id)).toBe(true);
    expect(result.adReport?.stats.map((card) => card.value)).toEqual(['1200', '36', '3%', '250']);
    expect(result.adReport?.daily).toEqual(report.daily);
  });

  it('throws NotFound for an unknown ad number without touching AdsService', async () => {
    const { db } = createDbStub({ select: [...baseSelects(), []] });
    const { service, adsService } = createService(db);

    await expect(service.getAnalytics('99')).rejects.toBeInstanceOf(NotFoundException);
    expect(adsService.getReportForAdmin).not.toHaveBeenCalled();
  });

  it('rejects a malformed ?ad= before it can reach the uuid column', async () => {
    const { db } = createDbStub({ select: baseSelects() });
    const { service } = createService(db);

    await expect(service.getAnalytics('not-a-uuid')).rejects.toBeInstanceOf(NotFoundException);
    // Only the five analytics selects ran — no ads lookup.
    expect(db.select).toHaveBeenCalledTimes(5);
  });

  it('rejects digit ad numbers past the int4 range before querying', async () => {
    // 2147483648 = int4 max + 1, 9999999999과 30자리 수는 파싱해도 int4를 넘는다.
    for (const ad of ['2147483648', '9999999999', '9'.repeat(30)]) {
      const { db } = createDbStub({ select: baseSelects() });
      const { service, adsService } = createService(db);

      await expect(service.getAnalytics(ad)).rejects.toBeInstanceOf(NotFoundException);
      // Only the five analytics selects ran — no ads lookup.
      expect(db.select).toHaveBeenCalledTimes(5);
      expect(adsService.getReportForAdmin).not.toHaveBeenCalled();
    }
  });
});

describe('AdminService — settings', () => {
  const user = {
    id: 'admin-1',
    name: '관리자',
    email: 'admin@example.com',
    role: 'admin',
  } as never;

  it('getSettings는 프로필 역할을 로그인 사용자의 role에서 가져온다', async () => {
    const { db } = createDbStub();
    const { service } = createService(db);

    const result = await service.getSettings(user);

    expect(result.profile).toMatchObject({ name: '관리자', role: '관리자' });
  });

  it('getSettings는 AdminSettingsService의 그룹/값(기본값 병합)을 그대로 쓴다', async () => {
    const { db } = createDbStub();
    const settings = createSettingsStub({ ...DEFAULT_VALUES, maintenanceMode: true });
    const { service } = createService(db, undefined, undefined, undefined, settings);

    const result = await service.getSettings(user);

    expect(result.groups).toBe(SETTINGS_GROUPS);
    expect(result.values).toEqual({ ...DEFAULT_VALUES, maintenanceMode: true });
    // 설정 row는 AdminSettingsService만 읽는다 — 중복 정의/기본값 불일치 방지.
    expect(db.select).not.toHaveBeenCalled();
  });

  it('updateSettings는 AdminSettingsService.update에 위임하고 최신 설정을 돌려준다', async () => {
    const { db } = createDbStub();
    const settings = createSettingsStub();
    const { service } = createService(db, undefined, undefined, undefined, settings);

    const result = await service.updateSettings({ maintenanceMode: true }, user);

    expect(settings.update).toHaveBeenCalledWith({ maintenanceMode: true });
    expect(result.values).toEqual(DEFAULT_VALUES);
    expect(db.insert).not.toHaveBeenCalled();
  });
});
