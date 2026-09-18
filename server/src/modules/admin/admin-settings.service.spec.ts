import { describe, expect, it } from 'vitest';
import {
  ADMIN_SETTINGS_ID,
  AdminSettingsService,
  DEFAULT_VALUES,
} from './admin-settings.service.js';

/** 인메모리 settings row를 돌리는 drizzle 스텁. */
function createDbStub(initial?: { id: string; values: Record<string, boolean> }) {
  let row = initial;
  const insertCalls: { id: string; values: Record<string, boolean> }[] = [];
  const db: any = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => (row ? [row] : []),
        }),
      }),
    }),
    insert: () => ({
      values: (v: { id: string; values: Record<string, boolean> }) => {
        insertCalls.push(v);
        return {
          onConflictDoUpdate: async ({ set }: { set: { values: Record<string, boolean> } }) => {
            row = { id: v.id, values: set.values };
          },
        };
      },
    }),
  };
  return { db: db as never, insertCalls };
}

describe('AdminSettingsService', () => {
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

  it('공유 id로 저장된 기존 row를 isEnabled가 읽는다', async () => {
    const { db } = createDbStub({ id: ADMIN_SETTINGS_ID, values: { contestAutoPublish: true } });
    const service = new AdminSettingsService(db);

    expect(await service.isEnabled('contestAutoPublish')).toBe(true);
    expect(await service.isEnabled('maintenanceMode')).toBe(false);
  });
});
