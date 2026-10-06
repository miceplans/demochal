import { configureGeneratedApi, generated } from '@semochal/api-client';
import type { MetadataRoute } from 'next';

import { DEFAULT_SITE_ORIGIN, SITE_ORIGIN } from '@/lib/biz';

const ORIGIN = SITE_ORIGIN || DEFAULT_SITE_ORIGIN;

// 빌드 시점(API에 닿지 않는 Docker 빌드 등)에 결과가 굳지 않도록 요청마다 생성한다.
export const dynamic = 'force-dynamic';

// 사이트맵 프로토콜 한도는 파일당 50,000 URL — 정적 경로 몫을 빼고 남는 만큼만 담는다.
const MAX_URLS = 50_000;
const PAGE_SIZE = 100;
const MAX_PAGES = 500;

// 서버 렌더링에는 상대 경로('/api' 리라이트)가 통하지 않아 API 서버 주소로 직접 호출한다.
function serverApiBaseUrl(): string {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  const target = process.env.API_PROXY_TARGET ?? (apiUrl?.startsWith('http') ? apiUrl : undefined);
  return (target ?? 'http://localhost:3001').replace(/\/$/, '');
}

// 공개(published) 콘테스트만 /contests/{id}로 열거한다. draft는 목록 API가, closed는 includeClosed=false가 거른다.
// lastModified는 API가 내려주는 createdAt(콘테스트에 updatedAt 컬럼이 없음)이며 빌드 시각을 쓰지 않는다(#354).
async function contestEntries(limit: number): Promise<MetadataRoute.Sitemap> {
  configureGeneratedApi({ baseUrl: serverApiBaseUrl() });
  const entries: MetadataRoute.Sitemap = [];
  let cursor: string | undefined;
  for (let page = 0; page < MAX_PAGES && entries.length < limit; page += 1) {
    const { data } = await generated.listChallenges({
      limit: PAGE_SIZE,
      includeClosed: false,
      cursor,
    });
    for (const challenge of data.items ?? []) {
      if (challenge.status !== 'published') continue;
      entries.push({
        url: `${ORIGIN}/contests/${challenge.id}`,
        lastModified: challenge.createdAt ? new Date(challenge.createdAt) : undefined,
        changeFrequency: 'daily',
        priority: 0.8,
      });
    }
    if (!data.nextCursor) break;
    cursor = data.nextCursor;
  }
  return entries.slice(0, limit);
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${ORIGIN}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${ORIGIN}/explore`, changeFrequency: 'daily', priority: 0.9 },
    {
      url: `${ORIGIN}/contests/public-data`,
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${ORIGIN}/contests/public-data/teams`,
      changeFrequency: 'daily',
      priority: 0.8,
    },
    { url: `${ORIGIN}/teams`, changeFrequency: 'daily', priority: 0.7 },
    { url: `${ORIGIN}/youth`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${ORIGIN}/advertising`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${ORIGIN}/terms`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${ORIGIN}/privacy`, changeFrequency: 'yearly', priority: 0.3 },
  ];

  // API 장애가 sitemap 전체(정적 경로 포함)를 500으로 만들지 않게 동적 항목만 비운다.
  try {
    return [...staticEntries, ...(await contestEntries(MAX_URLS - staticEntries.length))];
  } catch (error) {
    console.error('[sitemap] 콘테스트 목록 조회 실패 — 정적 경로만 반환', error);
    return staticEntries;
  }
}
