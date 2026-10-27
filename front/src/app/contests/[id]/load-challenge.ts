import { configureGeneratedApi, generated } from '@semochal/api-client';
import { cache } from 'react';

// 서버 렌더링에는 상대 경로('/api' 리라이트)가 통하지 않아 API 서버 주소로 직접 호출한다(sitemap.ts와 동일).
function serverApiBaseUrl(): string | null {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  const target = process.env.API_PROXY_TARGET ?? (apiUrl?.startsWith('http') ? apiUrl : undefined);
  if (target) return target.replace(/\/$/, '');
  return process.env.NODE_ENV === 'production' ? null : 'http://localhost:3001';
}

// 메타데이터·JSON-LD용 공개 공모전 조회. 실패/미공개는 null로 두어 페이지 렌더를 막지 않는다.
export const loadPublishedChallenge = cache(async (id: string) => {
  const baseUrl = serverApiBaseUrl();
  if (!baseUrl) return null;
  try {
    configureGeneratedApi({ baseUrl });
    const res = await generated.getChallenge(id);
    return res.status === 200 && res.data.status === 'published' ? res.data : null;
  } catch {
    return null;
  }
});
