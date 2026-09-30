import { vi, type Mock } from 'vitest';
import { AdminService } from './admin.service.js';
import { DEFAULT_VALUES, SETTINGS_GROUPS } from './admin-settings.service.js';

/**
 * Auto-chaining thenable stand-in for a drizzle query builder: every method
 * call returns the proxy itself and awaiting it resolves the scripted value.
 * `spies` captures method args (e.g. `set`/`values`) for assertions.
 */
export function chainable(
  resolved: unknown,
  spies: Record<string, (args: unknown[]) => void> = {},
) {
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
export function createDbStub(
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
    transaction: vi.fn(async (callback: (tx: unknown) => unknown) => callback(db)),
  };
  return { db, setCalls, valuesCalls, selectWhereCalls };
}

/** drizzle SQL 트리에서 문자열 값(Param 포함)을 모은다. */
export function collectStrings(node: any, acc: string[] = []): string[] {
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

export function createNotificationsStub(): { create: Mock } {
  return { create: vi.fn().mockResolvedValue({}) };
}

/** Does a drizzle SQL tree reference this exact column object (by identity)? */
export function referencesColumn(node: any, target: unknown, seen = new Set<unknown>()): boolean {
  if (node === target) return true;
  if (!node || typeof node !== 'object' || seen.has(node)) return false;
  seen.add(node);
  if (Array.isArray(node)) return node.some((c) => referencesColumn(c, target, seen));
  if (Array.isArray(node.queryChunks)) return referencesColumn(node.queryChunks, target, seen);
  return false;
}

export const zeroAdReport = {
  totals: { impressions: 0, clicks: 0, ctr: 0 },
  daily: [],
  hourly: [],
  monthlyClicks: [],
};

export function createAdsStub(report: unknown = zeroAdReport): { getReportForAdmin: Mock } {
  return { getReportForAdmin: vi.fn().mockResolvedValue(report) };
}

export function createFilesStub() {
  return {
    getPrivateReadUrl: vi.fn(async (key: string) => `https://signed.example/${key}`),
  };
}

export function createService(
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

export function createSettingsStub(values: Record<string, boolean> = DEFAULT_VALUES): {
  get: Mock;
  update: Mock;
} {
  return {
    get: vi.fn().mockResolvedValue({ groups: SETTINGS_GROUPS, values }),
    update: vi.fn().mockResolvedValue(values),
  };
}

export const verificationRow = { id: 'v1', businessId: 'b1', status: 'pending' };
export const businessRow = { id: 'b1', ownerUserId: 'owner-1' };
export const reportRow = {
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
