import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@emotion/react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { theme } from '@/styles/theme';
import { NotificationsPage } from './NotificationsPage';

const mocks = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  meLoaded: true,
  managedTeams: [] as Array<Record<string, unknown>>,
  myApplications: [] as Array<Record<string, unknown>>,
  myTeamApplications: [] as Array<Record<string, unknown>>,
  myNotifications: [] as Array<Record<string, unknown>>,
  interests: [] as string[],
  saveInterestsMutate: vi.fn(),
  push: vi.fn(),
  me: { name: '홍길동', bio: '안녕하세요' } as {
    name: string;
    bio: string;
    externalLinks?: { label: string; url: string }[];
  },
}));

vi.mock('@/features/auth/AuthProvider', () => import('@/test/auth-mock'));
vi.mock('@semochal/api-client', () => ({
  ApiError: class ApiError extends Error {},
  generated: {
    useGetMyAuthInfo: () => ({
      data: mocks.meLoaded ? { status: 200, data: mocks.me } : undefined,
    }),
    useGetInterests: () => ({
      data: { status: 200, data: { categories: mocks.interests } },
      isSuccess: true,
      isError: false,
    }),
    useSaveInterests: () => ({ mutate: mocks.saveInterestsMutate, isPending: false }),
    getGetInterestsQueryKey: () => ['interests'],
    getListRecommendedChallengesQueryKey: () => ['recommendedChallenges'],
    useUpdateMyProfile: () => ({ mutateAsync: mocks.mutateAsync }),
    useRequestPresignedUpload: () => ({ mutateAsync: vi.fn() }),
    useFinalizeUpload: () => ({ mutateAsync: vi.fn() }),
    useCreateCertificate: () => ({ mutateAsync: vi.fn() }),
    getListMyCertificatesQueryKey: () => ['certificates'],
    useListMyCertificates: () => ({ data: { data: [] } }),
    useListMyTeamApplications: () => ({
      data: { status: 200, data: mocks.myTeamApplications },
      isPending: false,
      isError: false,
    }),
    useListMyApplications: () => ({
      data: { status: 200, data: mocks.myApplications },
      isPending: false,
      isError: false,
    }),
    useListManagedTeams: () => ({
      data: { status: 200, data: mocks.managedTeams },
      isPending: false,
      isError: false,
    }),
    useListMyNotifications: () => ({
      data: { status: 200, data: mocks.myNotifications },
      isPending: false,
      isError: false,
    }),
    getListMyNotificationsQueryKey: () => ['notifications'],
    useMarkNotificationRead: () => ({ mutate: vi.fn(), isPending: false }),
    useUpdateTeamMember: () => ({ mutate: vi.fn(), isPending: false }),
    getGetMyAuthInfoQueryKey: () => ['myAuthInfo'],
  },
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }));

vi.mock('@/components/common/UserShell', () => ({
  UserShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Content: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  MyShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  myMenu: [],
}));

vi.mock('@/components/common/Toast', () => ({
  useToast: () => ({ success: mocks.success, error: mocks.error }),
}));

// 실제 Modal은 닫힌 dialog도 children을 렌더하므로, 열림 상태 기준으로만 렌더한다.
vi.mock('@/components/common/Feedback', () => ({
  Modal: ({
    open,
    title,
    children,
  }: {
    open: boolean;
    title: string;
    children: React.ReactNode;
  }) => (open ? <section aria-label={title}>{children}</section> : null),
}));

describe('NotificationsPage 채팅방 링크', () => {
  afterEach(() => {
    cleanup();
    mocks.myNotifications = [];
  });

  it('합격 알림의 채팅방 링크를 새 탭으로 연다', () => {
    mocks.myNotifications = [
      {
        id: 'n-1',
        type: 'team_matching',
        payload: { teamId: 't-1', status: 'accepted', chatLink: 'https://open.kakao.com/o/abc' },
        readAt: null,
        createdAt: '2026-10-20T00:00:00.000Z',
      },
    ];
    const queryClient = new QueryClient();
    render(
      <ThemeProvider theme={theme}>
        <QueryClientProvider client={queryClient}>
          <NotificationsPage />
        </QueryClientProvider>
      </ThemeProvider>,
    );

    const link = screen.getByRole('link', { name: 'https://open.kakao.com/o/abc' });
    expect(link.getAttribute('href')).toBe('https://open.kakao.com/o/abc');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
  });

  it('채팅방 링크 클릭이 알림 항목의 페이지 이동을 일으키지 않는다', async () => {
    mocks.myNotifications = [
      {
        id: 'n-1',
        type: 'team_matching',
        payload: { teamId: 't-1', status: 'accepted', chatLink: 'https://open.kakao.com/o/abc' },
        readAt: null,
        createdAt: '2026-10-20T00:00:00.000Z',
      },
    ];
    const user = userEvent.setup();
    const queryClient = new QueryClient();
    render(
      <ThemeProvider theme={theme}>
        <QueryClientProvider client={queryClient}>
          <NotificationsPage />
        </QueryClientProvider>
      </ThemeProvider>,
    );

    await user.click(screen.getByRole('link', { name: 'https://open.kakao.com/o/abc' }));
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it('채팅방 링크에서 Enter 키가 알림 항목의 페이지 이동을 일으키지 않는다', async () => {
    mocks.myNotifications = [
      {
        id: 'n-1',
        type: 'team_matching',
        payload: { teamId: 't-1', status: 'accepted', chatLink: 'https://open.kakao.com/o/abc' },
        readAt: null,
        createdAt: '2026-10-20T00:00:00.000Z',
      },
    ];
    const user = userEvent.setup();
    const queryClient = new QueryClient();
    render(
      <ThemeProvider theme={theme}>
        <QueryClientProvider client={queryClient}>
          <NotificationsPage />
        </QueryClientProvider>
      </ThemeProvider>,
    );

    screen.getByRole('link', { name: 'https://open.kakao.com/o/abc' }).focus();
    await user.keyboard('{Enter}');
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it('채팅방 링크가 없는 합격 알림은 링크 없이 렌더한다', () => {
    mocks.myNotifications = [
      {
        id: 'n-1',
        type: 'team_matching',
        payload: { teamId: 't-1', status: 'accepted' },
        readAt: null,
        createdAt: '2026-10-20T00:00:00.000Z',
      },
    ];
    const queryClient = new QueryClient();
    render(
      <ThemeProvider theme={theme}>
        <QueryClientProvider client={queryClient}>
          <NotificationsPage />
        </QueryClientProvider>
      </ThemeProvider>,
    );

    expect(screen.getByText('지원이 수락됐어요')).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('http(s)가 아닌 링크 payload는 렌더하지 않는다', () => {
    mocks.myNotifications = [
      {
        id: 'n-1',
        type: 'team_matching',
        payload: { teamId: 't-1', status: 'accepted', chatLink: 'javascript:alert(1)' },
        readAt: null,
        createdAt: '2026-10-20T00:00:00.000Z',
      },
    ];
    const queryClient = new QueryClient();
    render(
      <ThemeProvider theme={theme}>
        <QueryClientProvider client={queryClient}>
          <NotificationsPage />
        </QueryClientProvider>
      </ThemeProvider>,
    );

    expect(screen.queryByRole('link')).toBeNull();
  });
});
