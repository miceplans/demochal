import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
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

  /**
   * 온보딩 설문은 첫 가입/로그인 시 한 번만 받는다. 이미 저장된 설문은 덮어쓰지 않도록
   * `onboarding_survey IS NULL` 조건으로 갱신해 동시 제출도 한 건만 반영되게 한다.
   * 이후 관심분야 변경은 `PUT /interests`(관심분야 설정 페이지)가 담당한다.
   */
  async saveOnboardingSurvey(userId: string, dto: SaveOnboardingSurveyDto) {
    const [user] = await this.db
      .update(users)
      .set({ onboardingSurvey: dto })
      .where(and(eq(users.id, userId), isNull(users.onboardingSurvey)))
      .returning();
    if (user) return user.onboardingSurvey ?? {};
    await this.findById(userId);
    throw new ConflictException('이미 관심분야 설문을 완료했습니다.');
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
