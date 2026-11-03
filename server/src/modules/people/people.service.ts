import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, ilike, inArray, isNull, ne, or, sql } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
import { files, users } from '../../db/schema.js';
import { buildPublicFileUrl } from '../files/public-file-url.js';

export interface PeopleFilters {
  q?: string;
  /** recent(기본) | name */
  sort?: string;
  /** 콤마 구분 포지션 — 하나라도 일치하면 반환(OR, 정확 일치). */
  position?: string;
  /** 콤마 구분 지역 — 하나라도 일치하면 반환(OR, 정확 일치). */
  region?: string;
  /** 콤마 구분 기술스택 — 하나라도 보유하면 반환(OR). */
  stack?: string;
}

const splitList = (value?: string) =>
  (value ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

const escapeLike = (value: string) => value.replace(/[\\%_]/g, (ch) => `\\${ch}`);

const CARD_COLUMNS = {
  id: users.id,
  name: users.name,
  position: users.position,
  region: users.region,
  stacks: users.stacks,
  externalLinks: users.externalLinks,
  awardHistory: users.awardHistory,
  profileImageFileId: users.profileImageFileId,
};
type CardRow = {
  id: string;
  name: string | null;
  position: string | null;
  region: string | null;
  stacks: string[] | null;
  externalLinks: unknown;
  awardHistory: unknown;
  profileImageFileId: string | null;
};

// 탈퇴·정지 계정과 본인은 목록·추천에서 제외한다.
const visibleUserConditions = (viewerId: string) => [
  isNull(users.withdrawnAt),
  eq(users.suspended, false),
  eq(users.role, 'user'),
  ne(users.id, viewerId),
];

@Injectable()
export class PeopleService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  // TODO: "최신 활동 순"은 활동 로그가 없어 가입일(createdAt) 기준으로 대신한다.
  async list(filters: PeopleFilters, viewerId: string) {
    const conditions = visibleUserConditions(viewerId);
    const q = filters.q?.trim();
    if (q) conditions.push(ilike(users.name, `%${escapeLike(q)}%`));
    const positions = splitList(filters.position);
    if (positions.length > 0) conditions.push(inArray(users.position, positions));
    const regions = splitList(filters.region);
    if (regions.length > 0) conditions.push(inArray(users.region, regions));
    const stacks = splitList(filters.stack);
    if (stacks.length > 0) {
      conditions.push(
        or(...stacks.map((stack) => sql`jsonb_exists(${users.stacks}, ${stack})`)) ?? sql`true`,
      );
    }

    const rows = await this.db
      .select(CARD_COLUMNS)
      .from(users)
      .where(and(...conditions))
      .orderBy(filters.sort === 'name' ? asc(users.name) : desc(users.createdAt))
      .limit(200);
    return this.toCards(rows);
  }

  /**
   * "나와 맞는 사람 찾기": 본인 기술스택·지역과 겹치는 사용자를 점수순으로 추천한다.
   * 최신 가입 200명만 후보로 점수화한다(소규모 가정 — 사용자가 늘면 SQL 점수화 + 인덱스로 교체).
   */
  async recommended(viewerId: string, requestedLimit?: number) {
    const limit = Math.max(1, Math.min(20, Number.isFinite(requestedLimit) ? requestedLimit! : 3));
    const [viewer] = await this.db
      .select({ stacks: users.stacks, region: users.region })
      .from(users)
      .where(eq(users.id, viewerId))
      .limit(1);
    const myStacks = new Set((viewer?.stacks ?? []).map((stack) => stack.toLowerCase()));

    const rows = await this.db
      .select(CARD_COLUMNS)
      .from(users)
      .where(and(...visibleUserConditions(viewerId)))
      .orderBy(desc(users.createdAt))
      .limit(200);

    const ranked = rows
      .map((row) => {
        const shared = (row.stacks ?? []).filter((stack) => myStacks.has(stack.toLowerCase()));
        const card = this.cardFlags(row.externalLinks, row.awardHistory);
        const score =
          shared.length * 10 +
          (viewer?.region && row.region === viewer.region ? 5 : 0) +
          (card.hasGithub ? 2 : 0) +
          (card.hasPortfolio ? 2 : 0) +
          (card.hasAwards ? 1 : 0);
        return { row, score };
      })
      .sort(
        (left, right) =>
          right.score - left.score ||
          (left.row.id < right.row.id ? -1 : left.row.id > right.row.id ? 1 : 0),
      )
      .slice(0, limit)
      .map(({ row }) => row);
    return this.toCards(ranked);
  }

  private cardFlags(externalLinks: unknown, awardHistory: unknown) {
    const links = (Array.isArray(externalLinks) ? externalLinks : []) as {
      url?: unknown;
      portfolioBadge?: unknown;
    }[];
    const isGithub = (link: { url?: unknown }) =>
      typeof link.url === 'string' && link.url.toLowerCase().includes('github.com');
    return {
      // 카드에는 인증 배지 여부만 내려 개인 링크 URL은 목록에 노출하지 않는다.
      hasGithub: links.some(isGithub),
      // 링크만 추가해서는 주지 않는다. 신청 중(pending)은 숨기고 관리자가 승인한 링크만 인정한다.
      hasPortfolio: links.some((link) => !isGithub(link) && link.portfolioBadge === 'approved'),
      hasAwards: Array.isArray(awardHistory) && awardHistory.length > 0,
    };
  }

  private async toCards(rows: CardRow[]) {
    // 프로필 사진은 files를 한 번에 조회해 붙인다(카드마다 조회하는 N+1 방지).
    const fileIds = rows.flatMap((row) => (row.profileImageFileId ? [row.profileImageFileId] : []));
    const imageFiles =
      fileIds.length > 0
        ? await this.db.select().from(files).where(inArray(files.id, fileIds))
        : [];
    const urlById = new Map(imageFiles.map((file) => [file.id, buildPublicFileUrl(file)]));

    return rows.map(({ externalLinks, awardHistory, profileImageFileId, ...person }) => ({
      ...person,
      profileImageUrl: (profileImageFileId && urlById.get(profileImageFileId)) || null,
      ...this.cardFlags(externalLinks, awardHistory),
    }));
  }
}
