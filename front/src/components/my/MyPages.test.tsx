import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@emotion/react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { theme } from '@/styles/theme';
import { MyPage } from './MyPages';

const mocks = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  meLoaded: true,
  me: { name: '홍길동', bio: '안녕하세요' },
}));

vi.mock('@semochal/api-client', () => ({
  ApiError: class ApiError extends Error {},
  generated: {
    useGetMyAuthInfo: () => ({
      data: mocks.meLoaded ? { status: 200, data: mocks.me } : undefined,
    }),
    useUpdateMyProfile: () => ({ mutateAsync: mocks.mutateAsync }),
    useRequestPresignedUpload: () => ({ mutateAsync: vi.fn() }),
    useFinalizeUpload: () => ({ mutateAsync: vi.fn() }),
    useCreateCertificate: () => ({ mutateAsync: vi.fn() }),
    getListMyCertificatesQueryKey: () => ['certificates'],
    useListMyCertificates: () => ({ data: { data: [] } }),
    useListMyTeamApplications: () => ({
      data: { status: 200, data: [] },
      isPending: false,
      isError: false,
    }),
    useListMyApplications: () => ({
      data: { status: 200, data: [] },
      isPending: false,
      isError: false,
    }),
    getGetMyAuthInfoQueryKey: () => ['myAuthInfo'],
  },
}));

vi.mock('@/components/common/UserShell', () => ({
  UserShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Content: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  MyShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  myMenu: [],
}));

vi.mock('@/components/common/Toast', () => ({
  useToast: () => ({ success: mocks.success, error: mocks.error }),
}));

function renderMyPage() {
  const queryClient = new QueryClient();
  return render(
    <ThemeProvider theme={theme}>
      <QueryClientProvider client={queryClient}>
        <MyPage />
      </QueryClientProvider>
    </ThemeProvider>,
  );
}

describe('MyPage 한 줄 소개 인라인 편집', () => {
  afterEach(cleanup);
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.meLoaded = true;
    mocks.me = { name: '홍길동', bio: '안녕하세요' };
  });

  it('더블클릭하면 인라인 입력창이 열리고 Enter로 저장한다', async () => {
    mocks.mutateAsync.mockResolvedValue({ status: 200 });
    const user = userEvent.setup();
    renderMyPage();

    await user.dblClick(screen.getByText('안녕하세요'));
    const input = screen.getByLabelText('한 줄 소개') as HTMLInputElement;
    expect(input.value).toBe('안녕하세요');
    expect(input.maxLength).toBe(100);

    await user.clear(input);
    await user.type(input, '새로운 소개{Enter}');

    await waitFor(() =>
      expect(mocks.mutateAsync).toHaveBeenCalledWith({ data: { bio: '새로운 소개' } }),
    );
    expect(mocks.success).toHaveBeenCalledWith('한 줄 소개를 저장했어요');
    expect(screen.queryByLabelText('한 줄 소개')).toBeNull();
  });

  it('Escape를 누른 편집이 취소되고 저장하지 않는다', async () => {
    const user = userEvent.setup();
    renderMyPage();

    await user.dblClick(screen.getByText('안녕하세요'));
    await user.type(screen.getByLabelText('한 줄 소개'), '임시 소개{Escape}');

    expect(screen.queryByLabelText('한 줄 소개')).toBeNull();
    expect(screen.getByText('안녕하세요')).toBeTruthy();
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
  });

  it('포커스를 잃으면 편집이 취소된다', async () => {
    const user = userEvent.setup();
    renderMyPage();

    await user.dblClick(screen.getByText('안녕하세요'));
    await user.type(screen.getByLabelText('한 줄 소개'), '임시 소개');
    await user.click(screen.getByText('기술 스택'));

    expect(screen.queryByLabelText('한 줄 소개')).toBeNull();
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
  });

  it('소개가 없으면 placeholder 더블클릭으로 새 소개를 추가한다', async () => {
    mocks.mutateAsync.mockResolvedValue({ status: 200 });
    mocks.me = { name: '홍길동', bio: '' };
    const user = userEvent.setup();
    renderMyPage();

    await user.dblClick(screen.getByText('한 줄 소개를 남겨보세요.'));
    const input = screen.getByLabelText('한 줄 소개') as HTMLInputElement;
    expect(input.value).toBe('');

    await user.type(input, '첫 소개{Enter}');
    await waitFor(() =>
      expect(mocks.mutateAsync).toHaveBeenCalledWith({ data: { bio: '첫 소개' } }),
    );
  });

  it('연필 버튼 클릭도 인라인 편집을 연다', async () => {
    const user = userEvent.setup();
    renderMyPage();

    await user.click(screen.getByRole('button', { name: '한 줄 소개 수정하기' }));
    expect((screen.getByLabelText('한 줄 소개') as HTMLInputElement).value).toBe('안녕하세요');
  });

  it('서버 프로필을 받기 전에는 편집을 시작할 수 없다', async () => {
    mocks.meLoaded = false;
    const user = userEvent.setup();
    renderMyPage();

    const button = screen.getByRole('button', { name: '한 줄 소개 추가하기' });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    await user.dblClick(screen.getByText('한 줄 소개를 남겨보세요.'));
    expect(screen.queryByLabelText('한 줄 소개')).toBeNull();
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
  });

  it('저장에 실패하면 에러 토스트를 띄우고 편집을 유지한다', async () => {
    mocks.mutateAsync.mockRejectedValue(new Error('boom'));
    const user = userEvent.setup();
    renderMyPage();

    await user.dblClick(screen.getByText('안녕하세요'));
    await user.type(screen.getByLabelText('한 줄 소개'), '새로운 소개{Enter}');

    await waitFor(() =>
      expect(mocks.error).toHaveBeenCalledWith('저장에 실패했어요', '잠시 후 다시 시도해주세요'),
    );
    expect(screen.getByLabelText('한 줄 소개')).toBeTruthy();
  });
});
