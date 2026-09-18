import { describe, expect, it } from 'vitest';
import {
  ADMIN_SETTINGS_ID,
  AdminSettingsService,
  DEFAULT_VALUES,
  GROUPS,
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

  it('일부 키만 저장된 row가 있어도 getValues는 나머지를 DEFAULT_VALUES로 병합한다', async () => {
    // 회귀 테스트: row를 그대로 반환하면(병합하지 않으면) 저장되지 않은 reportAlert가
    // 선언된 기본값 true 대신 undefined(=== true 검사에서 false)로 조용히 뒤집힌다.
    const { db } = createDbStub({ id: ADMIN_SETTINGS_ID, values: { maintenanceMode: true } });
    const service = new AdminSettingsService(db);

    expect(await service.isEnabled('maintenanceMode')).toBe(true);
    expect(await service.isEnabled('reportAlert')).toBe(true);
    expect(await service.isEnabled('newBusinessAlert')).toBe(true);
    expect(await service.isEnabled('bizAutoApprove')).toBe(false);
  });

  it('GROUPS에 노출된 모든 토글 키는 DEFAULT_VALUES에 boolean 기본값을 갖는다', () => {
    // 메타데이터(GROUPS)와 기본값(DEFAULT_VALUES)이 서로 다른 곳에서 관리되다 어긋나는
    // 것(예: newBusinessAlert가 메타데이터에는 있지만 기본값이 없던 버그)을 막는다.
    for (const row of GROUPS.flatMap((group) => group.rows)) {
      expect(typeof DEFAULT_VALUES[row.key]).toBe('boolean');
    }
  });
});
