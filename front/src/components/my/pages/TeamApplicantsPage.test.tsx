import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@emotion/react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { theme } from '@/styles/theme';
import { TeamApplicantsPage } from './TeamApplicantsPage';

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

describe('TeamApplicantsPage 지원현황 표', () => {
  afterEach(() => {
    cleanup();
    mocks.managedTeams = [];
  });

  it('지원자 정보와 결과 컨트롤을 균형 잡힌 세 열로 표시한다', () => {
    mocks.managedTeams = [
      {
        id: 'team-1',
        title: '테스트 팀',
        challengeTitle: '테스트',
        businessName: '(주)마이스플랜즈',
        members: [{ id: 'member-1', name: '성이름', role: '프론트엔드', status: 'pending' }],
      },
    ];
    const queryClient = new QueryClient();
    render(
      <ThemeProvider theme={theme}>
        <QueryClientProvider client={queryClient}>
          <TeamApplicantsPage />
        </QueryClientProvider>
      </ThemeProvider>,
    );

    const table = screen.getByRole('table');
    expect(table.querySelectorAll('col')).toHaveLength(3);
    expect(screen.getByRole('columnheader', { name: '이름' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: '지원 역할' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: '결과' })).toBeTruthy();
    expect(screen.getByText('성이름')).toBeTruthy();
    expect(screen.getByText('프론트엔드')).toBeTruthy();
    expect(screen.getByRole('combobox', { name: '성이름 결과' })).toBeTruthy();
  });
});
