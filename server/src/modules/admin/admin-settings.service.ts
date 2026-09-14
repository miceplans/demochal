import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
import { adminSettings, users } from '../../db/schema.js';

const SINGLETON_ID = 'singleton';

const GROUPS = [
  {
    title: '서비스 설정',
    rows: [
      { key: 'bizAutoApprove', label: '기관 가입 자동 승인', description: 'NTS 검증 통과 시 관리자 확인 없이 즉시 승인합니다.' },
      { key: 'contestAutoPublish', label: '공고 자동 게시', description: '등록된 공고를 검수 없이 바로 게시합니다.' },
      { key: 'maintenanceMode', label: '점검 모드', description: '서비스 전체를 점검 상태로 전환합니다.' },
    ],
  },
  {
    title: '알림 설정',
    rows: [
      { key: 'reportAlert', label: '신고 접수 알림', description: '신고가 접수되면 관리자에게 즉시 알립니다.' },
    ],
  },
];

const DEFAULT_VALUES: Record<string, boolean> = {
  bizAutoApprove: false,
  contestAutoPublish: false,
  maintenanceMode: false,
  reportAlert: true,
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
      .values({ id: SINGLETON_ID, values })
      .onConflictDoUpdate({ target: adminSettings.id, set: { values } });
    return values;
  }

  async isEnabled(key: string): Promise<boolean> {
    return (await this.getValues())[key] === true;
  }

  private async getValues(): Promise<Record<string, boolean>> {
    const [row] = await this.db
      .select()
      .from(adminSettings)
      .where(eq(adminSettings.id, SINGLETON_ID))
      .limit(1);
    return (row?.values as Record<string, boolean>) ?? DEFAULT_VALUES;
  }

  private async getProfile(adminUserId: string) {
    const [user] = await this.db.select().from(users).where(eq(users.id, adminUserId)).limit(1);
    if (!user) return null;
    // No 2FA feature exists anywhere in this codebase yet — honestly false, not fabricated.
    return { name: user.name, role: user.role, email: user.email, twoFactorEnabled: false };
  }
}
