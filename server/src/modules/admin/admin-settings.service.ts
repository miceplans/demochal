import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
import { adminSettings } from '../../db/schema.js';

/** Admin API(AdminService)와 설정 소비자(isEnabled)가 반드시 같은 row를 보게 하는 키. */
export const ADMIN_SETTINGS_ID = 'default';

/** 점검 기간 저장 키 — 값은 ISO 8601 문자열이거나 null(미설정). 점검 모드는 이 기간 동안만 켜진다. */
export const MAINTENANCE_START_KEY = 'maintenanceStartAt';
export const MAINTENANCE_END_KEY = 'maintenanceEndAt';

// Settings metadata is static copy (Korean labels/descriptions from the
// design spec); only the boolean values are persisted.
export const SETTINGS_GROUPS = [
  {
    title: '서비스 설정',
    rows: [
      {
        key: 'contestAutoPublish',
        label: '공고 자동 게시',
        description: '기관이 등록한 공고를 검수 없이 바로 게시합니다.',
      },
    ],
  },
  {
    title: '알림 설정',
    rows: [
      {
        key: 'reportAlert',
        label: '신고 접수 알림',
        description: '신고가 접수되면 관리자에게 즉시 알림을 보냅니다.',
      },
      {
        key: 'newBusinessAlert',
        label: '신규 기관 가입 알림',
        description: '신규 기관 가입 신청이 들어오면 관리자에게 알림을 보냅니다.',
      },
    ],
  },
];

// reportAlert/newBusinessAlert는 AdminAlertsService가 신고 접수/기관 등록 시 읽어 알림을 보낸다.
export const DEFAULT_VALUES: Record<string, boolean> = {
  contestAutoPublish: true,
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

/**
 * 점검 시각 입력을 검증해 정규화한다.
 * undefined는 "제공되지 않음"(저장값 유지), null은 "초기화"를 의미하고,
 * 문자열은 파싱 가능한 날짜여야 하며 UTC ISO 형태로 통일해 저장한다.
 */
function normalizeMaintenanceInput(key: string, value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string') {
    throw new BadRequestException(`${key}은(는) 날짜 문자열이거나 null이어야 합니다.`);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException(`${key}은(는) 유효한 날짜 형식이어야 합니다.`);
  }
  return parsed.toISOString();
}

/** 저장된 값에서 읽을 때 쓴다 — 무효한 문자열은 null과 같이 본다. */
function normalizeStoredMaintenance(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : value;
}

@Injectable()
export class AdminSettingsService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async get() {
    return {
      groups: SETTINGS_GROUPS,
      values: await this.getValues(),
      maintenance: await this.getMaintenance(),
    };
  }

  /**
   * 부분 갱신: 알려진 불리언 키와 점검 시각 키만 저장된 값 위에 덮어쓴다.
   * 점검 기간은 저장 전에 시작 < 종료를 검증해 잘못된 창이 들어가는 것을 막는다.
   */
  async update(partial: Record<string, unknown>) {
    const stored = { ...(await this.getStoredValues()), ...pickKnownBooleans(partial) };
    const start = normalizeMaintenanceInput(MAINTENANCE_START_KEY, partial[MAINTENANCE_START_KEY]);
    const end = normalizeMaintenanceInput(MAINTENANCE_END_KEY, partial[MAINTENANCE_END_KEY]);
    if (start !== undefined) stored[MAINTENANCE_START_KEY] = start;
    if (end !== undefined) stored[MAINTENANCE_END_KEY] = end;
    const windowStart = normalizeStoredMaintenance(stored[MAINTENANCE_START_KEY]);
    const windowEnd = normalizeStoredMaintenance(stored[MAINTENANCE_END_KEY]);
    if (windowStart !== null && windowEnd !== null && windowStart >= windowEnd) {
      throw new BadRequestException('점검 시작 시각은 종료 시각보다 이전이어야 합니다.');
    }
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

  /** 현재 시각이 점검 기간 안이면 true — MaintenanceGuard가 요청마다 호출한다. */
  async isMaintenanceActive(): Promise<boolean> {
    return (await this.getMaintenance()).active;
  }

  /** 저장된 점검 기간과 현재 활성 여부. 창이 없거나 무효하면 active는 false다. */
  async getMaintenance(): Promise<{
    startAt: string | null;
    endAt: string | null;
    active: boolean;
  }> {
    const stored = await this.getStoredValues();
    const startAt = normalizeStoredMaintenance(stored[MAINTENANCE_START_KEY]);
    const endAt = normalizeStoredMaintenance(stored[MAINTENANCE_END_KEY]);
    const now = Date.now();
    const active =
      startAt !== null &&
      endAt !== null &&
      new Date(startAt).getTime() <= now &&
      now < new Date(endAt).getTime();
    return { startAt, endAt, active };
  }

  /** 저장되지 않은 키는 항상 기본값을 따른다(첫 저장 시 일부 키만 있어도 동일). */
  private async getValues(): Promise<Record<string, boolean>> {
    const stored = await this.getStoredValues();
    const booleans = Object.fromEntries(
      Object.entries(stored).filter(
        (entry): entry is [string, boolean] => typeof entry[1] === 'boolean',
      ),
    );
    return { ...DEFAULT_VALUES, ...booleans };
  }

  /** 저장된 jsonb에서 알려진 키만 읽는다 — 레거시 키는 이후 저장 시 자연 정리된다. */
  private async getStoredValues(): Promise<Record<string, unknown>> {
    const [row] = await this.db
      .select()
      .from(adminSettings)
      .where(eq(adminSettings.id, ADMIN_SETTINGS_ID))
      .limit(1);
    if (!row?.values || typeof row.values !== 'object') return {};
    return {
      ...pickKnownBooleans(row.values),
      ...(Object.hasOwn(row.values, MAINTENANCE_START_KEY)
        ? {
            [MAINTENANCE_START_KEY]: (row.values as Record<string, unknown>)[MAINTENANCE_START_KEY],
          }
        : {}),
      ...(Object.hasOwn(row.values, MAINTENANCE_END_KEY)
        ? { [MAINTENANCE_END_KEY]: (row.values as Record<string, unknown>)[MAINTENANCE_END_KEY] }
        : {}),
    };
  }
}
