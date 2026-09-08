import { HttpClient, type HttpClientOptions } from './http';
import type {
  Application,
  Business,
  Challenge,
  FileObject,
  Notification,
  Order,
  PaginatedResult,
  PresignedUploadRequest,
  PresignedUploadResponse,
  User,
  Verification,
} from './types';

export function createApiClient(options: HttpClientOptions) {
  const http = new HttpClient(options);

  return {
    auth: {
      me: () => http.get<User>('/auth/me'),
      login: (body: { email: string; password: string }) =>
        http.post<{ accessToken: string }>('/auth/login', body),
    },
    businesses: {
      get: (id: string) => http.get<Business>(`/businesses/${id}`),
      register: (body: Pick<Business, 'name' | 'registrationNumber'>) =>
        http.post<Business>('/businesses', body),
    },
    verifications: {
      submit: (body: { businessId: string; documentFileId: string }) =>
        http.post<Verification>('/verifications', body),
      get: (id: string) => http.get<Verification>(`/verifications/${id}`),
    },
    challenges: {
      list: (params?: { cursor?: string; limit?: number }) => {
        const q = new URLSearchParams();
        if (params?.cursor) q.set('cursor', params.cursor);
        if (params?.limit) q.set('limit', String(params.limit));
        const qs = q.toString();
        return http.get<PaginatedResult<Challenge>>(`/challenges${qs ? `?${qs}` : ''}`);
      },
      get: (id: string) => http.get<Challenge>(`/challenges/${id}`),
      create: (
        body: Pick<
          Challenge,
          'title' | 'description' | 'price' | 'capacity' | 'startDate' | 'endDate'
        >,
      ) => http.post<Challenge>('/challenges', body),
    },
    applications: {
      apply: (body: { challengeId: string }) => http.post<Application>('/applications', body),
      listMine: () => http.get<Application[]>('/applications/me'),
    },
    orders: {
      get: (id: string) => http.get<Order>(`/orders/${id}`),
    },
    files: {
      requestUpload: (body: PresignedUploadRequest) =>
        http.post<PresignedUploadResponse>('/files/presign', body),
      get: (id: string) => http.get<FileObject>(`/files/${id}`),
    },
    notifications: {
      list: () => http.get<Notification[]>('/notifications'),
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
