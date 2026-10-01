import { sql, inArray, count } from 'drizzle-orm';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { businesses, challenges, users } from './schema.js';
import {
  dateAfterToday,
  MOCK_BUSINESS_EMAIL,
  MOCK_BUSINESS_ID,
  MOCK_BUSINESS_OWNER_ID,
  MOCK_CHALLENGES,
} from './seed-data.js';

// 개발 전용 seed — `pnpm --filter @semochal/server db:seed`.
// docker compose의 로컬 PostgreSQL(기본 postgres://semochal:semochal@localhost:5432/semochal)에
// 목 기관/공모전을 넣어 공개 목록·상세 화면을 확인할 수 있게 한다.
// 모든 행을 고정 UUID 기준 upsert해 재실행해도 행 수가 늘지 않고 최신 데이터로 갱신된다.
if (process.env.NODE_ENV === 'production') {
  throw new Error('The development seed must not run in production.');
}

// docker-compose.yml의 로컬 PostgreSQL 기본 연결. 명시적 DATABASE_URL이 우선한다.
const databaseUrl =
  process.env.DATABASE_URL ?? 'postgres://semochal:semochal@localhost:5432/semochal';

const pool = new Pool({ connectionString: databaseUrl });
const db = drizzle(pool);

try {
  await db
    .insert(users)
    .values({
      id: MOCK_BUSINESS_OWNER_ID,
      email: MOCK_BUSINESS_EMAIL,
      name: 'SeMO 목데이터 운영팀',
      role: 'business',
    })
    .onConflictDoNothing();

  await db
    .insert(businesses)
    .values({
      id: MOCK_BUSINESS_ID,
      ownerUserId: MOCK_BUSINESS_OWNER_ID,
      name: 'SeMO 목데이터 기관',
      verificationStatus: 'verified',
      type: '기업',
    })
    .onConflictDoNothing();

  const challengeRows = MOCK_CHALLENGES.map((challenge) => ({
    id: challenge.id,
    businessId: MOCK_BUSINESS_ID,
    title: challenge.title,
    description: challenge.description,
    price: challenge.price,
    capacity: challenge.capacity,
    category: challenge.category,
    targets: [...challenge.targets],
    organizerType: challenge.organizerType,
    prizeAmount: challenge.prizeAmount,
    recruitMethod: challenge.recruitMethod,
    recruitUrl: challenge.recruitUrl ?? null,
    startDate: dateAfterToday(challenge.startOffsetDays),
    endDate: dateAfterToday(challenge.endOffsetDays),
    status: 'published',
  }));

  await db
    .insert(challenges)
    .values(challengeRows)
    .onConflictDoUpdate({
      target: challenges.id,
      set: {
        title: sql`excluded.title`,
        description: sql`excluded.description`,
        price: sql`excluded.price`,
        capacity: sql`excluded.capacity`,
        category: sql`excluded.category`,
        targets: sql`excluded.targets`,
        organizerType: sql`excluded.organizer_type`,
        prizeAmount: sql`excluded.prize_amount`,
        recruitMethod: sql`excluded.recruit_method`,
        recruitUrl: sql`excluded.recruit_url`,
        startDate: sql`excluded.start_date`,
        endDate: sql`excluded.end_date`,
        status: sql`excluded.status`,
      },
    });

  const seedIds = MOCK_CHALLENGES.map((challenge) => challenge.id);
  const [verifyRow] = await db
    .select({ seeded: count() })
    .from(challenges)
    .where(inArray(challenges.id, seedIds));
  const seeded = verifyRow?.seeded ?? 0;

  console.log(
    `Development seed complete: ${seeded}/${MOCK_CHALLENGES.length} published challenges present.`,
  );
  if (seeded !== MOCK_CHALLENGES.length) {
    throw new Error('Seed verification failed: some development challenges are missing.');
  }
} finally {
  await pool.end();
}
