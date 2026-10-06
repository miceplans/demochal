import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, ilike, inArray, isNull, ne, or, sql } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
import { users } from '../../db/schema.js';

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

@Injectable()
export class PeopleService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  // TODO: "최신 활동 순"은 활동 로그가 없어 가입일(createdAt) 기준으로 대신한다.
  async list(filters: PeopleFilters, viewerId: string) {
    const conditions = [
      isNull(users.withdrawnAt),
      eq(users.suspended, false),
      eq(users.role, 'user'),
      ne(users.id, viewerId),
    ];
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
      .select({
        id: users.id,
        name: users.name,
        position: users.position,
        region: users.region,
        stacks: users.stacks,
        externalLinks: users.externalLinks,
        awardHistory: users.awardHistory,
      })
      .from(users)
      .where(and(...conditions))
      .orderBy(filters.sort === 'name' ? asc(users.name) : desc(users.createdAt))
      .limit(200);

    return rows.map(({ externalLinks, awardHistory, ...person }) => {
      const links = (Array.isArray(externalLinks) ? externalLinks : []) as { url?: unknown }[];
      const isGithub = (link: { url?: unknown }) =>
        typeof link.url === 'string' && link.url.toLowerCase().includes('github.com');
      return {
        ...person,
        // 카드에는 인증 배지 여부만 내려 개인 링크 URL은 목록에 노출하지 않는다.
        hasGithub: links.some(isGithub),
        hasPortfolio: links.some((link) => !isGithub(link)),
        hasAwards: Array.isArray(awardHistory) && awardHistory.length > 0,
      };
    });
  }
}
