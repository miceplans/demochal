import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
import { users } from '../../db/schema.js';
import { surveyInterests } from '../challenges/interest-matching.js';
import type { SaveInterestsDto } from './dto/save-interests.dto.js';
import type { SaveNotificationSettingsDto } from './dto/save-notification-settings.dto.js';

@Injectable()
export class InterestsService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  // 아직 PUT /interests로 저장한 적 없는 사용자(users.interests가 비어 있음)에게는
  // 온볼딩 설문에서 선택한 관심분야를 기본값으로 낸다. 저장한 목록이 생기면 그것이
  // 기준이 된다. 온볼딩을 완료하지 않은 사용자는 빈 배열을 유지한다.
  async getInterests(userId: string) {
    const [user] = await this.db
      .select({ interests: users.interests, onboardingSurvey: users.onboardingSurvey })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const interests = user?.interests ?? [];
    if (interests.length > 0) return { categories: interests };
    return { categories: surveyInterests(user?.onboardingSurvey) };
  }

  async saveInterests(userId: string, dto: SaveInterestsDto) {
    await this.db.update(users).set({ interests: dto.categories }).where(eq(users.id, userId));
    return { categories: dto.categories };
  }

  // The client contract wraps each setting as { enabled }, but the stored
  // jsonb is a flat Record<string, boolean>.
  async saveNotificationSettings(userId: string, dto: SaveNotificationSettingsDto) {
    this.assertSettingsShape(dto);
    const flattened = Object.fromEntries(
      Object.entries(dto).map(([key, value]) => [key, value.enabled]),
    );
    await this.db
      .update(users)
      .set({ notificationSettings: flattened })
      .where(eq(users.id, userId));
    return flattened;
  }

  private assertSettingsShape(input: unknown): asserts input is SaveNotificationSettingsDto {
    if (typeof input !== 'object' || input === null || Array.isArray(input)) {
      throw new BadRequestException('알림 설정 형식이 올바르지 않습니다.');
    }
    for (const [key, value] of Object.entries(input)) {
      if (
        typeof value !== 'object' ||
        value === null ||
        Array.isArray(value) ||
        typeof (value as { enabled?: unknown }).enabled !== 'boolean'
      ) {
        throw new BadRequestException(`"${key}" 설정은 enabled(true/false) 값을 포함해야 합니다.`);
      }
    }
  }
}
