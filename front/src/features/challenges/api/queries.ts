'use client';

import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { myChallenges } from '@/data/biz-design';

// 화면 시연용: 모든 챌린지 조회는 서버 호출 없이 목업 데이터로 처리한다.
export function useChallengesInfinite(limit = 20) {
  return useInfiniteQuery({
    queryKey: ['challenges', limit],
    queryFn: () => Promise.resolve({ items: myChallenges.slice(0, limit), nextCursor: null }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

// 테이블도 같은 로컬 목업 데이터만 사용한다.
export function useChallengesQuery(limit = 50) {
  return useQuery({
    queryKey: ['challenges', 'list', limit],
    queryFn: () => Promise.resolve({ items: myChallenges.slice(0, limit), nextCursor: null }),
  });
}
