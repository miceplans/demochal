import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
import { users } from '../../db/schema.js';
import type { SaveInterestsDto } from './dto/save-interests.dto.js';
import type { SaveNotificationSettingsDto } from './dto/save-notification-settings.dto.js';

@Injectable()
export class InterestsService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async getInterests(userId: string) {
    const [user] = await this.db
      .select({ interests: users.interests })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return { categories: user?.interests ?? [] };
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
