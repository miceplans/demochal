import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
import { users } from '../../db/schema.js';

type NotificationSettingsInput = Record<string, { enabled: boolean }>;

@Injectable()
export class InterestsService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async saveInterests(userId: string, categories: string[]) {
    const [user] = await this.db
      .update(users)
      .set({ interestCategories: categories })
      .where(eq(users.id, userId))
      .returning();
    if (!user) throw new NotFoundException('User not found');
    return { categories: user.interestCategories as string[] };
  }

  async saveNotificationSettings(userId: string, settings: NotificationSettingsInput) {
    const flat: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(settings ?? {})) {
      if (typeof value?.enabled !== 'boolean') {
        throw new BadRequestException(`"${key}" must be an object with a boolean "enabled" field`);
      }
      flat[key] = value.enabled;
    }

    const [user] = await this.db
      .update(users)
      .set({ notificationSettings: flat })
      .where(eq(users.id, userId))
      .returning();
    if (!user) throw new NotFoundException('User not found');
    return user.notificationSettings as Record<string, boolean>;
  }
}
