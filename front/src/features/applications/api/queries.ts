'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useMyApplications() {
  return useQuery({
    queryKey: ['applications', 'me'],
    queryFn: () => api.applications.listMine(),
  });
}
