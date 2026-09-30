import { NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { reports } from '../../db/schema.js';
import { escapeLike, maskBizNumber, maskEmail } from './admin.service.js';
import { DEFAULT_VALUES, SETTINGS_GROUPS } from './admin-settings.service.js';
import {
  createDbStub,
  referencesColumn,
  createService,
  createSettingsStub,
  reportRow,
} from './admin.test-helpers.js';

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

describe('escapeLike', () => {
  it('escapes ilike wildcards and the escape character', () => {
    expect(escapeLike('100%_a\\b')).toBe('100\\%\\_a\\\\b');
    expect(escapeLike('plain')).toBe('plain');
  });
});
