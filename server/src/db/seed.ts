import { inArray, count } from 'drizzle-orm';
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
// 모든 행이 고정 UUID + onConflictDoNothing로 삽입되어 재실행해도 행 수가 늘지 않는다.
if (process.env.NODE_ENV === 'production') {
  throw new Error('The development seed must not run in production.');
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL must be set to seed the development database.');
}

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

  await db
    .insert(challenges)
    .values(
      MOCK_CHALLENGES.map((challenge) => ({
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
      })),
    )
    .onConflictDoNothing();

  const seedIds = MOCK_CHALLENGES.map((challenge) => challenge.id);
  const [{ seeded }] = await db
    .select({ seeded: count() })
    .from(challenges)
    .where(inArray(challenges.id, seedIds));

  console.log(`Development seed complete: ${seeded}/${MOCK_CHALLENGES.length} published challenges present.`);
  if (seeded !== MOCK_CHALLENGES.length) {
    throw new Error('Seed verification failed: some development challenges are missing.');
  }
} finally {
  await pool.end();
}
