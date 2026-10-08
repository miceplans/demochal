import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
import { files, users } from '../../db/schema.js';
import { buildPublicFileUrl } from '../files/public-file-url.js';
import type { UpdateProfileDto } from './dto/update-profile.dto.js';
import type { SaveOnboardingSurveyDto } from './dto/save-onboarding-survey.dto.js';

type UserRow = typeof users.$inferSelect;

@Injectable()
export class UsersService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async findById(id: string) {
    const [user] = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!user) throw new NotFoundException('사용자를 찾을 수 없습니다.');
    return this.withProfileImageUrl(toPublicUser(user), user.profileImageFileId);
  }

  /** Profile fields visible to other users — excludes email and account-management fields. */
  async findPublicProfileById(id: string) {
    const [user] = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!user) throw new NotFoundException('사용자를 찾을 수 없습니다.');
    return this.withProfileImageUrl(toPublicProfile(user), user.profileImageFileId);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    if (dto.profileImageFileId) await this.assertUsableProfileImage(dto.profileImageFileId, userId);
    const [user] = await this.db
      .update(users)
      .set({
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.role !== undefined && { position: dto.role }),
        ...(dto.region !== undefined && { region: dto.region }),
        ...(dto.bio !== undefined && { bio: dto.bio || null }),
        ...(dto.stacks !== undefined && { stacks: dto.stacks }),
        ...(dto.externalLinks !== undefined && { externalLinks: dto.externalLinks }),
        ...(dto.badges !== undefined && { badges: sanitizeBadges(dto.badges) }),
        ...(dto.awardHistory !== undefined && { awardHistory: dto.awardHistory }),
        // null은 삭제(기본 아바타로 복귀), 문자열은 위에서 검증한 파일로 교체.
        ...(dto.profileImageFileId !== undefined && { profileImageFileId: dto.profileImageFileId }),
      })
      .where(eq(users.id, userId))
      .returning();
    if (!user) throw new NotFoundException('사용자를 찾을 수 없습니다.');
    return this.withProfileImageUrl(toPublicUser(user), user.profileImageFileId);
  }

  /**
   * 프로필 이미지는 다른 사용자에게도 보이므로 public 버킷의 ready 이미지여야 하고,
   * 남의 파일 id를 끼워 넣지 못하게 업로더가 본인이어야 한다.
   */
  private async assertUsableProfileImage(fileId: string, userId: string) {
    const [file] = await this.db.select().from(files).where(eq(files.id, fileId)).limit(1);
    if (
      !file ||
      file.uploaderUserId !== userId ||
      file.uploadStatus !== 'ready' ||
      file.bucket !== 'public' ||
      !file.contentType.startsWith('image/')
    ) {
      throw new BadRequestException('프로필 이미지로 사용할 수 없는 파일입니다.');
    }
  }

  private async withProfileImageUrl<T extends object>(
    user: T,
    fileId: string | null,
  ): Promise<T & { profileImageUrl: string | null }> {
    if (!fileId) return { ...user, profileImageUrl: null };
    const [file] = await this.db.select().from(files).where(eq(files.id, fileId)).limit(1);
    return { ...user, profileImageUrl: file ? buildPublicFileUrl(file) : null };
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

/** 뱃지 라벨 정규화: trim·빈 값 제거·중복 제거(첫 등장 순서 유지) 후 저장한다. */
function sanitizeBadges(badges: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const badge of badges) {
    const trimmed = badge.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
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
    bio,
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
    bio,
    stacks,
    badges,
    externalLinks,
    awardHistory,
    createdAt,
  };
}
