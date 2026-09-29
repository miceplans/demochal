'use client';

import { generated } from '@semochal/api-client';

// 내 챌린지 지원 현황(GET /applications/me). 서버 데이터를 그대로 쓴다.
export function useMyApplications() {
  return generated.useListMyApplications();
}
