import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
import { users } from '../../db/schema.js';
import type { UpdateProfileDto } from './dto/update-profile.dto.js';
import type { SaveOnboardingSurveyDto } from './dto/save-onboarding-survey.dto.js';

type UserRow = typeof users.$inferSelect;

@Injectable()
export class UsersService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async findById(id: string) {
    const [user] = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!user) throw new NotFoundException('User not found');
    return toPublicUser(user);
  }

  /** Profile fields visible to other users — excludes email and account-management fields. */
  async findPublicProfileById(id: string) {
    const [user] = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!user) throw new NotFoundException('User not found');
    return toPublicProfile(user);
  }

  // TODO: derive userId from the authenticated request once auth is implemented.
  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const [user] = await this.db
      .update(users)
      .set({
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.role !== undefined && { position: dto.role }),
        ...(dto.region !== undefined && { region: dto.region }),
        ...(dto.stacks !== undefined && { stacks: dto.stacks }),
        ...(dto.externalLinks !== undefined && { externalLinks: dto.externalLinks }),
        ...(dto.awardHistory !== undefined && { awardHistory: dto.awardHistory }),
      })
      .where(eq(users.id, userId))
      .returning();
    if (!user) throw new NotFoundException('User not found');
    return toPublicUser(user);
  }

  async saveOnboardingSurvey(userId: string, dto: SaveOnboardingSurveyDto) {
    const [user] = await this.db
      .update(users)
      .set({ onboardingSurvey: dto })
      .where(eq(users.id, userId))
      .returning();
    if (!user) throw new NotFoundException('User not found');
    return user.onboardingSurvey ?? {};
  }
}

function toPublicUser(user: UserRow) {
  const { passwordHash: _passwordHash, ...publicUser } = user;
  return publicUser;
}

function toPublicProfile(user: UserRow) {
  const {
    id,
    name,
    role,
    position,
    region,
    stacks,
    badges,
    externalLinks,
    awardHistory,
    createdAt,
  } = user;
  return {
    id,
    name,
    role,
    position,
    region,
    stacks,
    badges,
    externalLinks,
    awardHistory,
    createdAt,
  };
}
