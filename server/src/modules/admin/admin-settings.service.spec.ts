import { describe, expect, it } from 'vitest';
import {
  ADMIN_SETTINGS_ID,
  AdminSettingsService,
  DEFAULT_VALUES,
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

describe('AdminSettingsService', () => {
  it('Object.prototype 키(toString 등)는 설정 키로 저장하지 않는다', async () => {
    const { db, insertCalls } = createDbStub();
    const service = new AdminSettingsService(db);

    await service.update(JSON.parse('{"toString":true,"constructor":true,"maintenanceMode":true}'));

    expect(insertCalls[0]?.values).toEqual({ maintenanceMode: true });
  });

  it('row가 없으면 DEFAULT_VALUES를 반환한다', async () => {
    const { db } = createDbStub();
    const service = new AdminSettingsService(db);

    const result = await service.get();

    expect(result.values).toEqual(DEFAULT_VALUES);
  });

  it('update는 공유 id 아래 저장하고 isEnabled가 같은 row를 반영한다 (읽기/쓰기 키 일관성)', async () => {
    const { db, insertCalls } = createDbStub();
    const service = new AdminSettingsService(db);

    await service.update({ maintenanceMode: true, bizAutoApprove: true });

    expect(insertCalls[0]?.id).toBe(ADMIN_SETTINGS_ID);
    // 읽기 경로가 쓰기와 다른 키를 쓰면(과거 'singleton' 버그) 여기서 false가 된다.
    expect(await service.isEnabled('maintenanceMode')).toBe(true);
    expect(await service.isEnabled('bizAutoApprove')).toBe(true);
    // 저장하지 않은 키는 기본값을 따른다.
    expect(await service.isEnabled('contestAutoPublish')).toBe(false);
  });

  it('일부 키만 저장된 row에서도 저장하지 않은 키는 기본값(true 포함)으로 읽는다', async () => {
    const { db } = createDbStub({ id: ADMIN_SETTINGS_ID, values: { maintenanceMode: true } });
    const service = new AdminSettingsService(db);

    // reportAlert 기본값은 true — row에 없다고 false로 읽으면 안 된다.
    expect(await service.isEnabled('reportAlert')).toBe(true);
    expect((await service.get()).values).toEqual({ ...DEFAULT_VALUES, maintenanceMode: true });
  });

  it('update는 기존 값 위에 병합하고 알 수 없는 키·불리언이 아닌 값은 저장하지 않는다', async () => {
    const { db, current } = createDbStub({
      id: ADMIN_SETTINGS_ID,
      values: { contestAutoPublish: true },
    });
    const service = new AdminSettingsService(db);

    const result = await service.update({
      maintenanceMode: true,
      unknownFlag: true,
      reportAlert: 'no',
    });

    expect(current()?.values).toEqual({ contestAutoPublish: true, maintenanceMode: true });
    expect(result).toEqual({ ...DEFAULT_VALUES, contestAutoPublish: true, maintenanceMode: true });
  });

  it('저장된 row의 알 수 없는 키는 읽을 때 무시한다', async () => {
    const { db } = createDbStub({ id: ADMIN_SETTINGS_ID, values: { legacyKey: true } });
    const service = new AdminSettingsService(db);

    expect((await service.get()).values).toEqual(DEFAULT_VALUES);
  });
});
