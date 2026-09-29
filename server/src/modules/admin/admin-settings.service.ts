import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
import { adminSettings } from '../../db/schema.js';

/** Admin API(AdminService)와 설정 소비자(isEnabled)가 반드시 같은 row를 보게 하는 키. */
export const ADMIN_SETTINGS_ID = 'default';

// Settings metadata is static copy (Korean labels/descriptions from the
// design spec); only the boolean values are persisted.
export const SETTINGS_GROUPS = [
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
        description: '신고가 접수되면 관리자에게 즉시 알림을 볩니다.',
      },
      {
        key: 'newBusinessAlert',
        label: '신규 기관 가입 알림',
        description: '신규 기관 가입 신청이 들어오면 관리자에게 알림을 볩니다.',
      },
    ],
  },
];

// TODO: reportAlert/newBusinessAlert는 저장만 되고 아직 알림 발송에 연결되지 않았다.
export const DEFAULT_VALUES: Record<string, boolean> = {
  bizAutoApprove: false,
  contestAutoPublish: false,
  maintenanceMode: false,
  reportAlert: true,
  newBusinessAlert: false,
};

/** 알려진 설정 키의 불리언 값만 남긴다 — PUT 본문과 저장된 jsonb 모두 신뢰하지 않는다. */
function pickKnownBooleans(values: unknown): Record<string, boolean> {
  if (!values || typeof values !== 'object') return {};
  return Object.fromEntries(
    Object.entries(values).filter(
      ([key, value]) => Object.hasOwn(DEFAULT_VALUES, key) && typeof value === 'boolean',
    ),
  ) as Record<string, boolean>;
}

@Injectable()
export class AdminSettingsService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async get() {
    return { groups: SETTINGS_GROUPS, values: await this.getValues() };
  }

  /** 부분 갱신: 알려진 키만 저장된 값 위에 덮어쓰고, 기본값이 병합된 전체 값을 돌려준다. */
  async update(partial: Record<string, unknown>) {
    const stored = { ...(await this.getStoredValues()), ...pickKnownBooleans(partial) };
    await this.db
      .insert(adminSettings)
      .values({ id: ADMIN_SETTINGS_ID, values: stored })
      .onConflictDoUpdate({
        target: adminSettings.id,
        set: { values: stored, updatedAt: new Date() },
      });
    return { ...DEFAULT_VALUES, ...stored };
  }

  async isEnabled(key: string): Promise<boolean> {
    return (await this.getValues())[key] === true;
  }

  /** 저장되지 않은 키는 항상 기본값을 따른다(첫 저장 시 일부 키만 있어도 동일). */
  private async getValues(): Promise<Record<string, boolean>> {
    return { ...DEFAULT_VALUES, ...(await this.getStoredValues()) };
  }

  private async getStoredValues(): Promise<Record<string, boolean>> {
    const [row] = await this.db
      .select()
      .from(adminSettings)
      .where(eq(adminSettings.id, ADMIN_SETTINGS_ID))
      .limit(1);
    return pickKnownBooleans(row?.values);
  }
}
