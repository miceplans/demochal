import { describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import {
  ADMIN_SETTINGS_ID,
  AdminSettingsService,
  DEFAULT_VALUES,
  MAINTENANCE_END_KEY,
  MAINTENANCE_START_KEY,
} from './admin-settings.service.js';

/** 인메모리 settings row를 돌리는 drizzle 스텁. */
function createDbStub(initial?: { id: string; values: Record<string, unknown> }) {
  let row = initial;
  const insertCalls: { id: string; values: Record<string, unknown> }[] = [];
  const db: any = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => (row ? [row] : []),
        }),
      }),
    }),
    insert: () => ({
      values: (v: { id: string; values: Record<string, unknown> }) => {
        insertCalls.push(v);
        return {
          onConflictDoUpdate: async ({ set }: { set: { values: Record<string, unknown> } }) => {
            row = { id: v.id, values: set.values };
          },
        };
      },
    }),
  };
  return { db: db as never, insertCalls, current: () => row };
}

const isoHoursFromNow = (hours: number) => new Date(Date.now() + hours * 3_600_000).toISOString();

describe('AdminSettingsService', () => {
  it('Object.prototype 키(toString 등)는 설정 키로 저장하지 않는다', async () => {
    const { db, insertCalls } = createDbStub();
    const service = new AdminSettingsService(db);

    await service.update(
      JSON.parse('{"toString":true,"constructor":true,"contestAutoPublish":true}'),
    );

    expect(insertCalls[0]?.values).toEqual({ contestAutoPublish: true });
  });

  it('row가 없으면 DEFAULT_VALUES와 비어 있는 점검 기간을 반환한다', async () => {
    const { db } = createDbStub();
    const service = new AdminSettingsService(db);

    const result = await service.get();

    expect(result.values).toEqual(DEFAULT_VALUES);
    expect(result.maintenance).toEqual({ startAt: null, endAt: null, active: false });
  });

  it('update는 공유 id 아래 저장하고 isEnabled가 같은 row를 반영한다 (읽기/쓰기 키 일관성)', async () => {
    const { db, insertCalls } = createDbStub();
    const service = new AdminSettingsService(db);

    await service.update({ reportAlert: false, contestAutoPublish: true });

    expect(insertCalls[0]?.id).toBe(ADMIN_SETTINGS_ID);
    // 읽기 경로가 쓰기와 다른 키를 쓰면(과거 'singleton' 버그) 여기서 false가 된다.
    expect(await service.isEnabled('reportAlert')).toBe(false);
    expect(await service.isEnabled('contestAutoPublish')).toBe(true);
    // 저장하지 않은 키는 기본값(false)을 따른다.
    expect(await service.isEnabled('newBusinessAlert')).toBe(false);
  });

  it('일부 키만 저장된 row에서도 저장하지 않은 키는 기본값(true 포함)으로 읽는다', async () => {
    const { db } = createDbStub({ id: ADMIN_SETTINGS_ID, values: { newBusinessAlert: true } });
    const service = new AdminSettingsService(db);

    // reportAlert 기본값은 true — row에 없다고 false로 읽으면 안 된다.
    expect(await service.isEnabled('reportAlert')).toBe(true);
    expect((await service.get()).values).toEqual({ ...DEFAULT_VALUES, newBusinessAlert: true });
  });

  it('update는 기존 값 위에 병합하고 알 수 없는 키·불리언이 아닌 값은 저장하지 않는다', async () => {
    const { db, current } = createDbStub({
      id: ADMIN_SETTINGS_ID,
      values: { contestAutoPublish: true },
    });
    const service = new AdminSettingsService(db);

    const result = await service.update({
      newBusinessAlert: true,
      unknownFlag: true,
      reportAlert: 'no',
    });

    expect(current()?.values).toEqual({ contestAutoPublish: true, newBusinessAlert: true });
    expect(result).toEqual({ ...DEFAULT_VALUES, contestAutoPublish: true, newBusinessAlert: true });
  });

  it('저장된 row의 알 수 없는 키와 레거시 maintenanceMode는 읽을 때 무시한다', async () => {
    const { db } = createDbStub({
      id: ADMIN_SETTINGS_ID,
      values: { legacyKey: true, maintenanceMode: true },
    });
    const service = new AdminSettingsService(db);

    expect((await service.get()).values).toEqual(DEFAULT_VALUES);
    expect((await service.get()).maintenance.active).toBe(false);
  });

  it('점검 기간을 저장하면 ISO 형태로 보관하고 get()/isMaintenanceActive()가 같은 row를 반영한다', async () => {
    const { db, insertCalls } = createDbStub();
    const service = new AdminSettingsService(db);
    const start = isoHoursFromNow(-1);
    const end = isoHoursFromNow(2);

    await service.update({ [MAINTENANCE_START_KEY]: start, [MAINTENANCE_END_KEY]: end });

    expect(insertCalls[0]?.values[MAINTENANCE_START_KEY]).toBe(new Date(start).toISOString());
    const maintenance = (await service.get()).maintenance;
    expect(maintenance).toEqual({
      startAt: new Date(start).toISOString(),
      endAt: new Date(end).toISOString(),
      active: true,
    });
    expect(await service.isMaintenanceActive()).toBe(true);
  });

  it.each([
    ['미래에 시작', isoHoursFromNow(1), isoHoursFromNow(3)],
    ['이미 종료', isoHoursFromNow(-3), isoHoursFromNow(-1)],
    ['시작만 있음', isoHoursFromNow(-1), null],
    ['종료만 있음', null, isoHoursFromNow(1)],
  ])('점검 기간이 %s하면 점검은 비활성이다', async (_label, start, end) => {
    const { db } = createDbStub();
    const service = new AdminSettingsService(db);

    await service.update({ [MAINTENANCE_START_KEY]: start, [MAINTENANCE_END_KEY]: end });

    expect((await service.get()).maintenance.active).toBe(false);
    expect(await service.isMaintenanceActive()).toBe(false);
  });

  it('시작 시각이 종료 시각보다 같거나 늦으면 저장을 거부한다', async () => {
    const { db, insertCalls } = createDbStub();
    const service = new AdminSettingsService(db);

    await expect(
      service.update({
        [MAINTENANCE_START_KEY]: isoHoursFromNow(2),
        [MAINTENANCE_END_KEY]: isoHoursFromNow(1),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.update({
        [MAINTENANCE_START_KEY]: isoHoursFromNow(1),
        [MAINTENANCE_END_KEY]: isoHoursFromNow(1),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(insertCalls).toHaveLength(0);
  });

  it('유효하지 않은 날짜 문자열은 저장을 거부한다', async () => {
    const { db, insertCalls } = createDbStub();
    const service = new AdminSettingsService(db);

    await expect(service.update({ [MAINTENANCE_START_KEY]: 'not-a-date' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      service.update({ [MAINTENANCE_END_KEY]: '2026-13-40T99:99' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(insertCalls).toHaveLength(0);
  });

  it('날짜 문자열이 아닌 값도 저장을 거부한다', async () => {
    const { db, insertCalls } = createDbStub();
    const service = new AdminSettingsService(db);

    await expect(service.update({ [MAINTENANCE_START_KEY]: 123 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(insertCalls).toHaveLength(0);
  });

  it('한쪽 시각만 갱신할 때 저장된 상대 시각과 충돌하면 거부하고, 충돌 없으면 허용한다', async () => {
    const { db, insertCalls } = createDbStub({
      id: ADMIN_SETTINGS_ID,
      values: { [MAINTENANCE_END_KEY]: isoHoursFromNow(1) },
    });
    const service = new AdminSettingsService(db);

    // 저장된 종료(+1h)보다 늦은 시작만 본래도 거부해야 한다.
    await expect(
      service.update({ [MAINTENANCE_START_KEY]: isoHoursFromNow(2) }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(insertCalls).toHaveLength(0);

    // 저장된 종료보다 이른 시작은 부분 갱신으로 허용한다.
    const validStart = isoHoursFromNow(0.5);
    await service.update({ [MAINTENANCE_START_KEY]: validStart });
    expect(insertCalls).toHaveLength(1);
    expect(insertCalls[0]?.values[MAINTENANCE_START_KEY]).toBe(new Date(validStart).toISOString());
  });

  it('경계 시각에서는 시작 시각이면 활성이고 종료 시각과 같으면 비활성이다', async () => {
    vi.useFakeTimers();
    try {
      const now = new Date('2026-10-19T12:00:00.000Z');
      vi.setSystemTime(now);

      const starting = new AdminSettingsService(
        createDbStub({
          id: ADMIN_SETTINGS_ID,
          values: {
            [MAINTENANCE_START_KEY]: now.toISOString(),
            [MAINTENANCE_END_KEY]: new Date(now.getTime() + 60_000).toISOString(),
          },
        }).db,
      );
      expect(await starting.isMaintenanceActive()).toBe(true);

      const ending = new AdminSettingsService(
        createDbStub({
          id: ADMIN_SETTINGS_ID,
          values: {
            [MAINTENANCE_START_KEY]: new Date(now.getTime() - 60_000).toISOString(),
            [MAINTENANCE_END_KEY]: now.toISOString(),
          },
        }).db,
      );
      expect(await ending.isMaintenanceActive()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('null로 저장하면 점검 기간이 초기화된다', async () => {
    const { db } = createDbStub({
      id: ADMIN_SETTINGS_ID,
      values: {
        [MAINTENANCE_START_KEY]: isoHoursFromNow(-1),
        [MAINTENANCE_END_KEY]: isoHoursFromNow(1),
      },
    });
    const service = new AdminSettingsService(db);

    await service.update({ [MAINTENANCE_START_KEY]: null, [MAINTENANCE_END_KEY]: null });

    expect((await service.get()).maintenance).toEqual({
      startAt: null,
      endAt: null,
      active: false,
    });
  });

  it('datetime-local 형식(로컬 시간) 입력은 UTC ISO로 정규화해 저장한다', async () => {
    const { db, insertCalls } = createDbStub();
    const service = new AdminSettingsService(db);

    await service.update({ [MAINTENANCE_START_KEY]: '2026-10-19T06:00' });

    const stored = insertCalls[0]?.values[MAINTENANCE_START_KEY];
    expect(stored).toBe(new Date('2026-10-19T06:00').toISOString());
    expect(new Date(stored as string).getTime()).not.toBeNaN();
  });
});
