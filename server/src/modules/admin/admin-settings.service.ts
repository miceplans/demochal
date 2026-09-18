import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
import { adminSettings, users } from '../../db/schema.js';

/**
 * Admin API(AdminService)와 설정 소비자(isEnabled)가 반드시 같은 row를 보게 하는 키.
 *
 * 배포 시 활성화 동작 주의: 이 값은 과거 'singleton'에서 'default'로 바뀌었다. 그 전까지는
 * Admin API(PUT /admin/settings)가 'singleton' row에 쓰고, 런타임 소비자
 * (maintenance.guard.ts의 maintenanceMode, verifications.processor.ts의 bizAutoApprove,
 * challenges.service.ts의 contestAutoPublish)는 'default' row를 읽었기 때문에 관리자가
 * 화면에서 토글을 켜도 실제로는 아무 효과가 없는 write-only 상태였다. 이번 수정으로 두 경로가
 * 같은 'default' row를 공유하게 되면서, DB에 이미 남아 있던 'default' row의 값이 배포
 * 즉시 "처음으로" 실제 동작에 반영된다. 예: 과거에 bizAutoApprove: true가 저장돼 있었다면
 * 배포 직후부터 NTS 인증 통과 건이 즉시 자동 승인되고, maintenanceMode: true가 저장돼
 * 있었다면 배포 즉시 서비스 전체가 점검 모드로 전환된다. 배포 담당자는 배포 전에
 * admin_settings 테이블의 id='default' row 값을 확인하고 필요하면 초기화해야 한다.
 */
export const ADMIN_SETTINGS_ID = 'default';

/**
 * 설정 화면에 노출되는 그룹/토글 메타데이터의 단일 소스. AdminService.getSettings()도 이
 * 목록을 그대로 재사용한다 — 메타데이터(라벨/설명)와 기본값(DEFAULT_VALUES)이 서로 다른
 * 파일에서 각자 관리되다 어긋나는 일(예: 메타데이터에는 있지만 기본값이 없는 토글)을 막기
 * 위함이다. admin-settings.service.spec.ts가 두 목록의 키 일치를 검증한다.
 */
export const GROUPS = [
  {
    title: '서비스 설정',
    rows: [
      {
        key: 'bizAutoApprove',
        label: '기관 가입 자동 승인',
        description: '제출 서류 심사 없이 기관 가입 신청을 즉시 승인합니다.',
      },
      {
        key: 'contestAutoPublish',
        label: '공고 자동 게시',
        description: '기관이 등록한 공고를 검수 없이 바로 게시합니다.',
      },
      {
        key: 'maintenanceMode',
        label: '점검 모드',
        description: '접속자에게 점검 안내를 표시하고 서비스를 일시 중단합니다.',
      },
    ],
  },
  {
    title: '알림 설정',
    rows: [
      {
        key: 'reportAlert',
        label: '신고 접수 알림',
        description: '신고가 접수되면 관리자에게 즉시 알림을 봅니다.',
      },
      {
        key: 'newBusinessAlert',
        label: '신규 기관 가입 알림',
        description: '신규 기관 가입 신청이 들어오면 관리자에게 알림을 봅니다.',
      },
    ],
  },
];

export const DEFAULT_VALUES: Record<string, boolean> = {
  bizAutoApprove: false,
  contestAutoPublish: false,
  maintenanceMode: false,
  reportAlert: true,
  newBusinessAlert: true,
};

@Injectable()
export class AdminSettingsService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async get(adminUserId?: string) {
    const values = await this.getValues();
    const profile = adminUserId ? await this.getProfile(adminUserId) : null;
    return { profile, groups: GROUPS, values };
  }

  async update(partial: Record<string, boolean>) {
    const values = { ...(await this.getValues()), ...partial };
    await this.db
      .insert(adminSettings)
      .values({ id: ADMIN_SETTINGS_ID, values })
      .onConflictDoUpdate({ target: adminSettings.id, set: { values } });
    return values;
  }

  async isEnabled(key: string): Promise<boolean> {
    return (await this.getValues())[key] === true;
  }

  /**
   * 저장된 row와 DEFAULT_VALUES를 병합해 반환한다(public — AdminService.getSettings()도
   * 같은 병합 로직을 재사용한다). row가 일부 키만 가지고 있어도(과거의 부분 저장, 수동 DB
   * 조작, 새로 추가된 토글 등) 나머지는 선언된 기본값을 따른다 — row를 그대로 반환하면
   * 저장되지 않은 키가 false로 취급되어 true가 기본값인 토글(reportAlert 등)이 조용히
   * 뒤집힐 수 있다.
   */
  async getValues(): Promise<Record<string, boolean>> {
    const [row] = await this.db
      .select()
      .from(adminSettings)
      .where(eq(adminSettings.id, ADMIN_SETTINGS_ID))
      .limit(1);
    return { ...DEFAULT_VALUES, ...(row?.values as Record<string, boolean>) };
  }

  private async getProfile(adminUserId: string) {
    const [user] = await this.db.select().from(users).where(eq(users.id, adminUserId)).limit(1);
    if (!user) return null;
    // No 2FA feature exists anywhere in this codebase yet — honestly false, not fabricated.
    return { name: user.name, role: user.role, email: user.email, twoFactorEnabled: false };
  }
}
