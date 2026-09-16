import { HttpClient, type HttpClientOptions } from './http';
import type {
  Ad,
  AdProduct,
  AdReport,
  Application,
  ApplyChallengeRequest,
  BizDashboard,
  Business,
  Challenge,
  ChallengeStats,
  CreateAdRequest,
  CreateTeamRequest,
  FileObject,
  Notification,
  OnboardingSurvey,
  Order,
  PaginatedResult,
  PaymentCard,
  PaymentHistoryItem,
  PresignedUploadRequest,
  PresignedUploadResponse,
  RegisterPaymentCardRequest,
  Team,
  UpdateApplicationRequest,
  UpdateBusinessRequest,
  UpdateProfileRequest,
  User,
  Verification,
} from './types';

export function createApiClient(options: HttpClientOptions) {
  const http = new HttpClient(options);

  return {
    auth: {
      me: () => http.get<User>('/auth/me'),
      login: (body: { email: string; password: string }) =>
        http.post<{ user: User }>('/auth/login', body),
      register: (body: { email: string; password: string; name: string }) =>
        http.post<{ user: User }>('/auth/register', body),
      logout: () => http.post<void>('/auth/logout'),
    },
    users: {
      get: (id: string) => http.get<User>(`/users/${id}`),
      updateMe: (body: UpdateProfileRequest) => http.patch<User>('/users/me', body),
      saveSurvey: (body: OnboardingSurvey) =>
        http.put<OnboardingSurvey>('/users/me/survey', body),
    },
    businesses: {
      get: (id: string) => http.get<Business>(`/businesses/${id}`),
      register: (body: Pick<Business, 'name' | 'registrationNumber'>) =>
        http.post<Business>('/businesses', body),
      update: (id: string, body: UpdateBusinessRequest) =>
        http.patch<Business>(`/businesses/${id}`, body),
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
          'businessId' | 'title' | 'description' | 'price' | 'capacity' | 'startDate' | 'endDate' | 'category'
        >,
      ) => http.post<Challenge>('/challenges', body),
      getStats: (id: string) => http.get<ChallengeStats>(`/challenges/${id}/stats`),
      listSimilar: (id: string) => http.get<Challenge[]>(`/challenges/${id}/similar`),
      updateStatus: (id: string, status: 'published' | 'closed') =>
        http.patch<Challenge>(`/challenges/${id}/status`, { status }),
    },
    applications: {
      apply: (body: ApplyChallengeRequest) => http.post<Application>('/applications', body),
      listMine: () => http.get<Application[]>('/applications/me'),
      get: (id: string) => http.get<Application>(`/applications/${id}`),
      update: (id: string, body: UpdateApplicationRequest) =>
        http.patch<Application>(`/applications/${id}`, body),
    },
    teams: {
      list: (params?: { challengeId?: string; role?: string; region?: string; q?: string }) => {
        const q = new URLSearchParams();
        if (params?.challengeId) q.set('challengeId', params.challengeId);
        if (params?.role) q.set('role', params.role);
        if (params?.region) q.set('region', params.region);
        if (params?.q) q.set('q', params.q);
        const qs = q.toString();
        return http.get<Team[]>(`/teams${qs ? `?${qs}` : ''}`);
      },
      get: (id: string) => http.get<Team>(`/teams/${id}`),
      create: (body: CreateTeamRequest) => http.post<Team>('/teams', body),
      join: (id: string, role?: string) => http.post(`/teams/${id}/join`, role ? { role } : {}),
      updateMember: (id: string, memberId: string, status: 'accepted' | 'rejected') =>
        http.patch(`/teams/${id}/members/${memberId}`, { status }),
    },
    bookmarks: {
      list: (sort?: 'deadline' | 'latest' | 'popular') =>
        http.get<Challenge[]>(`/bookmarks${sort ? `?sort=${sort}` : ''}`),
      toggle: (challengeId: string, bookmarked: boolean) =>
        http.put<{ bookmarked: boolean }>(`/challenges/${challengeId}/bookmark`, { bookmarked }),
    },
    interests: {
      save: (categories: string[]) =>
        http.put<{ categories: string[] }>('/interests', { categories }),
      saveNotificationSettings: (settings: Record<string, { enabled: boolean }>) =>
        http.put<Record<string, boolean>>('/notification-settings', settings),
    },
    operations: {
      submitInquiry: (body: { name: string; contact: string; content: string }) =>
        http.post<{ id: string; received: boolean }>('/operations/inquiries', body),
    },
    admin: {
      approveVerification: (id: string) =>
        http.post<Verification>(`/admin/verifications/${id}/approve`),
      rejectVerification: (id: string, reason: string) =>
        http.post<Verification>(`/admin/verifications/${id}/reject`, { reason }),
    },
    ads: {
      listProducts: () => http.get<AdProduct[]>('/ads/products'),
      listMine: (status?: 'active' | 'paused' | 'ended') =>
        http.get<Ad[]>(`/ads${status ? `?status=${status}` : ''}`),
      create: (body: CreateAdRequest) => http.post<Ad>('/ads', body),
      update: (id: string, status: 'active' | 'paused' | 'ended') =>
        http.patch<Ad>(`/ads/${id}`, { status }),
      getReport: (id: string, params?: { from?: string; to?: string }) => {
        const q = new URLSearchParams();
        if (params?.from) q.set('from', params.from);
        if (params?.to) q.set('to', params.to);
        const qs = q.toString();
        return http.get<AdReport>(`/ads/${id}/report${qs ? `?${qs}` : ''}`);
      },
    },
    billing: {
      listCards: () => http.get<PaymentCard[]>('/billing/cards'),
      registerCard: (body: RegisterPaymentCardRequest) =>
        http.post<PaymentCard>('/billing/cards', body),
      getHistory: (params?: { from?: string; to?: string }) => {
        const q = new URLSearchParams();
        if (params?.from) q.set('from', params.from);
        if (params?.to) q.set('to', params.to);
        const qs = q.toString();
        return http.get<{ items: PaymentHistoryItem[]; total: number }>(
          `/billing/history${qs ? `?${qs}` : ''}`,
        );
      },
      getBizDashboard: () => http.get<BizDashboard>('/biz/dashboard'),
    },
    orders: {
      get: (id: string) => http.get<Order>(`/orders/${id}`),
    },
    files: {
      requestUpload: (body: PresignedUploadRequest) =>
        http.post<PresignedUploadResponse>('/files/presign', body),
      finalizeUpload: (id: string) => http.post<FileObject>(`/files/${id}/finalize`),
      get: (id: string) => http.get<FileObject>(`/files/${id}`),
    },
    notifications: {
      list: () => http.get<Notification[]>('/notifications'),
      markRead: (id: string) => http.patch<Notification>(`/notifications/${id}/read`),
      markAllRead: () => http.patch<{ read: boolean }>('/notifications/read-all'),
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
