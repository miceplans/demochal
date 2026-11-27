import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@emotion/react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { theme } from '@/styles/theme';
import { InterestsPage } from './InterestsPage';

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

describe('InterestsPage 온볼딩 관심분야', () => {
  afterEach(() => {
    cleanup();
    mocks.interests = [];
    vi.clearAllMocks();
  });

  function renderInterestsPage() {
    const queryClient = new QueryClient();
    return render(
      <ThemeProvider theme={theme}>
        <QueryClientProvider client={queryClient}>
          <InterestsPage />
        </QueryClientProvider>
      </ThemeProvider>,
    );
  }

  it('온볼딩에서 선택한 값이 기본 칩 옵션 어휘와 달라도 선택된 칩으로 표시된다', () => {
    mocks.interests = ['IT/SW', 'IT · 소프트웨어'];

    renderInterestsPage();

    const onboardingChip = screen.getByRole('button', { name: 'IT/SW' });
    expect(onboardingChip.getAttribute('aria-pressed')).toBe('true');
    expect(
      screen.getByRole('button', { name: 'IT · 소프트웨어' }).getAttribute('aria-pressed'),
    ).toBe('true');
    expect(screen.getByRole('button', { name: '디자인 · UX' }).getAttribute('aria-pressed')).toBe(
      'false',
    );
  });

  it('온볼딩 어휘 칩을 해제한 뒤 저장하면 저장 목록에서 빠지고 칩은 남아 있다', async () => {
    mocks.interests = ['IT/SW', '취업'];
    mocks.saveInterestsMutate.mockImplementation(
      (_data: unknown, options: { onSuccess?: () => void }) => options?.onSuccess?.(),
    );
    const user = userEvent.setup();

    renderInterestsPage();
    await user.click(screen.getByRole('button', { name: 'IT/SW' }));
    await user.click(screen.getByRole('button', { name: '저장하기' }));

    expect(mocks.saveInterestsMutate).toHaveBeenCalledWith(
      { data: { categories: ['취업'] } },
      expect.anything(),
    );
    // 해제한 칩은 이 화면에서 본 서버 값 기준으로 남아 있어 다시 선택할 수 있다.
    expect(screen.getByRole('button', { name: 'IT/SW' }).getAttribute('aria-pressed')).toBe(
      'false',
    );
    expect(mocks.success).toHaveBeenCalledWith('관심분야를 저장했어요');
  });

  it('서버에서 받은 전체 선택 목록이 저장 페이로드에 그대로 실린다', async () => {
    mocks.interests = ['IT/SW'];
    const user = userEvent.setup();

    renderInterestsPage();
    await user.click(screen.getByRole('button', { name: '디자인 · UX' }));
    await user.click(screen.getByRole('button', { name: '저장하기' }));

    expect(mocks.saveInterestsMutate).toHaveBeenCalledWith(
      { data: { categories: ['IT/SW', '디자인 · UX'] } },
      expect.anything(),
    );
  });

  it('저장 후 재조회돼 서버 목록에서 빠져도 해제한 온볼딩 칩은 남아 재선택 가능하다', async () => {
    mocks.interests = ['IT/SW', '취업'];
    mocks.saveInterestsMutate.mockImplementation(
      (_data: unknown, options: { onSuccess?: () => void }) => options?.onSuccess?.(),
    );
    const user = userEvent.setup();
    const view = (
      <ThemeProvider theme={theme}>
        <QueryClientProvider client={new QueryClient()}>
          <InterestsPage />
        </QueryClientProvider>
      </ThemeProvider>
    );
    const { rerender } = render(view);

    await user.click(screen.getByRole('button', { name: 'IT/SW' }));
    await user.click(screen.getByRole('button', { name: '저장하기' }));

    // 저장 직후 invalidate된 재조회 결과에서 IT/SW가 빠진 경우에도
    // 이 화면에서 본 값은 칩으로 남아 다시 선택할 수 있다.
    mocks.interests = ['취업'];
    rerender(view);

    const chip = screen.getByRole('button', { name: 'IT/SW' });
    expect(chip.getAttribute('aria-pressed')).toBe('false');
    await user.click(chip);
    await user.click(screen.getByRole('button', { name: '저장하기' }));
    expect(mocks.saveInterestsMutate).toHaveBeenLastCalledWith(
      { data: { categories: ['취업', 'IT/SW'] } },
      expect.anything(),
    );
  });

  it('관심분야를 전부 해제하면 저장하기가 비활성화된다', async () => {
    mocks.interests = ['IT/SW'];
    const user = userEvent.setup();

    renderInterestsPage();
    await user.click(screen.getByRole('button', { name: 'IT/SW' }));

    expect(screen.getByRole('button', { name: '저장하기' })).toHaveProperty('disabled', true);
    expect(mocks.saveInterestsMutate).not.toHaveBeenCalled();
  });
});
