'use client';

import { useQuery } from '@tanstack/react-query';
import { myApplications } from '@/data/user-design';

// 화면 시연용: 서버 대신 로컬 목업 데이터를 사용한다.
export function useMyApplications() {
  return useQuery({
    queryKey: ['applications', 'me'],
    queryFn: () => Promise.resolve(myApplications),
  });
}
