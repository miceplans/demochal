import { describe, expect, it } from 'vitest';
import { DEFAULT_VALUES, SETTINGS_GROUPS } from './admin-settings.service.js';
import { createDbStub, createService, createSettingsStub } from './admin.test-helpers.js';

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
