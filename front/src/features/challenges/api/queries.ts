'use client';

import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

// Cursor-based infinite scroll over GET /challenges.
// The server returns PaginatedResult<Challenge> with nextCursor.
export function useChallengesInfinite(limit = 20) {
  return useInfiniteQuery({
    queryKey: ['challenges', limit],
    queryFn: ({ pageParam }) => api.challenges.list({ cursor: pageParam, limit }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

// Single-page challenge list for table views (no pagination UI).
export function useChallengesQuery(limit = 50) {
  return useQuery({
    queryKey: ['challenges', 'list', limit],
    queryFn: () => api.challenges.list({ limit }),
  });
}
