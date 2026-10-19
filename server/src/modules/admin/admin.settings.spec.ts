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
    const settings = createSettingsStub({ ...DEFAULT_VALUES, bizAutoApprove: true });
    const { service } = createService(db, undefined, undefined, undefined, settings);

    const result = await service.getSettings(user);

    expect(result.groups).toBe(SETTINGS_GROUPS);
    expect(result.values).toEqual({ ...DEFAULT_VALUES, bizAutoApprove: true });
    expect(result.maintenance).toEqual({ startAt: null, endAt: null, active: false });
    // 설정 그룹/값은 AdminSettingsService에서만 온다 — 중복 정의/기본값 불일치 방지.
    // (twoFactorEnabled용 2FA 수단 조회 때문에 db.select 자체는 이제 호출된다.)
    expect(settings.get).toHaveBeenCalled();
  });

  it('등록된 2FA 수단이 없으면 twoFactorEnabled는 false다', async () => {
    const { db } = createDbStub({ select: [[], []] });
    const { service } = createService(db, undefined, undefined, undefined, createSettingsStub());

    const result = await service.getSettings(user);

    expect(result.profile.twoFactorEnabled).toBe(false);
  });

  it.each([
    ['verified TOTP', [[{ userId: 'admin-1' }], []]],
    ['패스키', [[], [{ id: 'pk-1' }]]],
  ])('%s가 있으면 twoFactorEnabled는 true다', async (_label, selectQueue) => {
    const { db } = createDbStub({ select: selectQueue });
    const { service } = createService(db, undefined, undefined, undefined, createSettingsStub());

    const result = await service.getSettings(user);

    expect(result.profile.twoFactorEnabled).toBe(true);
  });

  it('updateSettings는 AdminSettingsService.update에 위임하고 최신 설정을 돌려준다', async () => {
    const { db } = createDbStub();
    const settings = createSettingsStub();
    const { service } = createService(db, undefined, undefined, undefined, settings);

    const result = await service.updateSettings({ contestAutoPublish: true }, user);

    expect(settings.update).toHaveBeenCalledWith({ contestAutoPublish: true });
    expect(result.values).toEqual(DEFAULT_VALUES);
    expect(db.insert).not.toHaveBeenCalled();
  });
});
