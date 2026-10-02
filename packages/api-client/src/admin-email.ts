import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AdminEmailMessage } from './generated/model/adminEmailMessage';
import type { AdminEmailThread } from './generated/model/adminEmailThread';
import type { AdminEmailThreadDetail } from './generated/model/adminEmailThreadDetail';
import { apiFetch } from './mutator';

export type AdminEmailListParams = { q?: string; status?: 'open' | 'pending' | 'resolved' };
export type AdminEmailReply = { text: string; html?: string };
export type AdminEmailCompose = { to: string; subject: string; text: string; html?: string };
type Response<T> = { data: T; status: number; headers: Headers };

const queryString = (params?: AdminEmailListParams) => {
  const search = new URLSearchParams();
  if (params?.q) search.set('q', params.q);
  if (params?.status) search.set('status', params.status);
  const value = search.toString();
  return value ? `?${value}` : '';
};

export function listAdminEmails(params?: AdminEmailListParams) {
  return apiFetch<Response<AdminEmailThread[]>>(`/admin/emails${queryString(params)}`);
}

export function createAdminEmail(body: AdminEmailCompose) {
  return apiFetch<Response<AdminEmailMessage>>('/admin/emails', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function getAdminEmail(id: string) {
  return apiFetch<Response<AdminEmailThreadDetail>>(`/admin/emails/${encodeURIComponent(id)}`);
}

export function sendAdminEmailReply(id: string, body: AdminEmailReply) {
  return apiFetch<Response<AdminEmailMessage>>(`/admin/emails/${encodeURIComponent(id)}/replies`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function useListAdminEmails(params?: AdminEmailListParams) {
  return useQuery({ queryKey: ['admin-emails', params], queryFn: () => listAdminEmails(params) });
}

export function useGetAdminEmail(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['admin-email', id],
    queryFn: () => getAdminEmail(id),
    enabled: Boolean(id) && options?.enabled !== false,
  });
}

export function useSendAdminEmailReply() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: AdminEmailReply }) =>
      sendAdminEmailReply(id, data),
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['admin-email', variables.id] });
      void queryClient.invalidateQueries({ queryKey: ['admin-emails'] });
    },
  });
}

export function useCreateAdminEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AdminEmailCompose) => createAdminEmail(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-emails'] });
    },
  });
}
