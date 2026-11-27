import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@emotion/react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { theme } from '@/styles/theme';
import { ApplicationsPage } from './ApplicationsPage';

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

describe('ApplicationsPage 지원서 링크', () => {
  afterEach(() => {
    cleanup();
    mocks.myApplications = [];
    mocks.myTeamApplications = [];
  });

  it('각 챌린지 지원 행에 /my/applications/{id}로 가는 지원서 링크가 있다', () => {
    mocks.myApplications = [
      {
        id: 'app-1',
        challengeId: 'challenge-1',
        challengeTitle: '2026 AI 챌린지',
        businessName: '한국데이터산업진흥원',
        status: 'submitted',
      },
      {
        id: 'app-2',
        challengeId: 'challenge-2',
        challengeTitle: '빅데이터 공모전',
        businessName: '세모협회',
        status: 'reviewing',
      },
    ];
    const queryClient = new QueryClient();
    render(
      <ThemeProvider theme={theme}>
        <QueryClientProvider client={queryClient}>
          <ApplicationsPage />
        </QueryClientProvider>
      </ThemeProvider>,
    );

    const links = screen.getAllByRole('link', { name: '지원서 보기' });
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/my/applications/app-1',
      '/my/applications/app-2',
    ]);
  });

  it('팀 지원 결과를 상태별로 표시한다', () => {
    mocks.myTeamApplications = [
      {
        id: 'team-member-1',
        challengeTitle: 'AI 챌린지',
        teamTitle: '내가 만든 팀',
        status: 'accepted',
      },
      {
        id: 'team-member-2',
        challengeTitle: '데이터 챌린지',
        teamTitle: '지원 팀',
        status: 'pending',
      },
      {
        id: 'team-member-3',
        challengeTitle: '환경 챌린지',
        teamTitle: '다른 팀',
        status: 'rejected',
      },
    ];
    const queryClient = new QueryClient();
    render(
      <ThemeProvider theme={theme}>
        <QueryClientProvider client={queryClient}>
          <ApplicationsPage />
        </QueryClientProvider>
      </ThemeProvider>,
    );

    expect(screen.getByText('내가 만든 팀')).toBeTruthy();
    expect(screen.getByText('합격')).toBeTruthy();
    expect(screen.getByText('검토중')).toBeTruthy();
    expect(screen.getByText('불합격')).toBeTruthy();
  });
});

describe('ApplicationsPage 팀 지원현황 채팅방 링크', () => {
  afterEach(() => {
    cleanup();
    mocks.myTeamApplications = [];
  });

  it('합격한 팀 지원 행의 채팅방 링크를 새 탭으로 연다', () => {
    mocks.myTeamApplications = [
      {
        id: 'app-1',
        challengeTitle: 'AI 챌린지',
        teamTitle: '세모 팀',
        status: 'accepted',
        chatLink: 'https://open.kakao.com/o/abc',
      },
    ];
    const queryClient = new QueryClient();
    render(
      <ThemeProvider theme={theme}>
        <QueryClientProvider client={queryClient}>
          <ApplicationsPage />
        </QueryClientProvider>
      </ThemeProvider>,
    );

    const link = screen.getByRole('link', { name: '채팅방 링크' });
    expect(link.getAttribute('href')).toBe('https://open.kakao.com/o/abc');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
  });

  it('검토중·불합격 행에는 채팅방 링크를 표시하지 않는다', () => {
    mocks.myTeamApplications = [
      {
        id: 'app-1',
        challengeTitle: 'AI 챌린지',
        teamTitle: '세모 팀',
        status: 'rejected',
        chatLink: null,
      },
      {
        id: 'app-2',
        challengeTitle: '빅데이터 공모전',
        teamTitle: '데이터 팀',
        status: 'pending',
        chatLink: 'https://open.kakao.com/o/xyz',
      },
    ];
    const queryClient = new QueryClient();
    render(
      <ThemeProvider theme={theme}>
        <QueryClientProvider client={queryClient}>
          <ApplicationsPage />
        </QueryClientProvider>
      </ThemeProvider>,
    );

    expect(screen.queryByRole('link', { name: '채팅방 링크' })).toBeNull();
  });

  it('http(s)가 아닌 링크는 렌더하지 않는다', () => {
    mocks.myTeamApplications = [
      {
        id: 'app-1',
        challengeTitle: 'AI 챌린지',
        teamTitle: '세모 팀',
        status: 'accepted',
        chatLink: 'javascript:alert(1)',
      },
    ];
    const queryClient = new QueryClient();
    render(
      <ThemeProvider theme={theme}>
        <QueryClientProvider client={queryClient}>
          <ApplicationsPage />
        </QueryClientProvider>
      </ThemeProvider>,
    );

    expect(screen.queryByRole('link', { name: '채팅방 링크' })).toBeNull();
  });
});
