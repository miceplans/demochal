import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@emotion/react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { theme } from '@/styles/theme';
import { MyPage, MyProfileEditPage } from './MyPages';

const mocks = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  meLoaded: true,
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

    await user.dblClick(screen.getByTitle('더블클릭하여 수정'));
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

    await user.dblClick(screen.getByTitle('더블클릭하여 수정'));
    await user.type(screen.getByLabelText('한 줄 소개'), '임시 소개{Escape}');

    expect(screen.queryByLabelText('한 줄 소개')).toBeNull();
    expect(screen.getByTitle('더블클릭하여 수정').textContent).toBe('안녕하세요');
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
  });

  it('포커스를 잃으면 편집이 취소된다', async () => {
    const user = userEvent.setup();
    renderMyPage();

    await user.dblClick(screen.getByTitle('더블클릭하여 수정'));
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

    await user.dblClick(screen.getByTitle('더블클릭하여 수정'));
    await user.type(screen.getByLabelText('한 줄 소개'), '새로운 소개{Enter}');

    await waitFor(() =>
      expect(mocks.error).toHaveBeenCalledWith('저장에 실패했어요', '잠시 후 다시 시도해주세요'),
    );
    expect(screen.getByLabelText('한 줄 소개')).toBeTruthy();
  });
});

describe('MyPage 링크 섹션', () => {
  afterEach(cleanup);
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.meLoaded = true;
    mocks.me = {
      name: '홍길동',
      bio: '안녕하세요',
      externalLinks: [{ label: 'GitHub', url: 'https://github.com/kim' }],
    };
  });

  it('등록된 링크를 인라인 편집 행으로 보여준다', () => {
    renderMyPage();
    expect((screen.getByLabelText('링크 이름 1') as HTMLInputElement).value).toBe('GitHub');
    expect((screen.getByLabelText('링크 주소 1') as HTMLInputElement).value).toBe(
      'https://github.com/kim',
    );
  });

  it('링크가 없으면 빈 편집 목록과 추가 버튼을 보여준다', () => {
    mocks.me.externalLinks = [];
    renderMyPage();
    expect(screen.queryByLabelText('링크 이름 1')).toBeNull();
    expect(screen.getByRole('button', { name: '링크 추가' })).toBeTruthy();
  });

  it('링크를 추가해 저장하면 스킴을 붙여 externalLinks로 저장한다', async () => {
    mocks.mutateAsync.mockResolvedValue({ status: 200 });
    mocks.me.externalLinks = [];
    const user = userEvent.setup();
    renderMyPage();

    await user.click(screen.getByRole('button', { name: '링크 추가' }));
    await user.type(screen.getByLabelText('링크 이름 1'), '블로그');
    await user.type(screen.getByLabelText('링크 주소 1'), 'blog.example.com');
    await user.tab();

    await waitFor(() =>
      expect(mocks.mutateAsync).toHaveBeenCalledWith({
        data: { externalLinks: [{ label: '블로그', url: 'https://blog.example.com' }] },
      }),
    );
  });

  it('기존 링크가 있는 상태에서 추가하면 기존 값을 유지한다', async () => {
    mocks.mutateAsync.mockResolvedValue({ status: 200 });
    const user = userEvent.setup();
    renderMyPage();

    await user.click(screen.getByRole('button', { name: '링크 추가' }));
    await user.type(screen.getByLabelText('링크 이름 2'), '노션');
    await user.type(screen.getByLabelText('링크 주소 2'), 'https://notion.so/kim');
    await user.tab();

    await waitFor(() =>
      expect(mocks.mutateAsync).toHaveBeenCalledWith({
        data: {
          externalLinks: [
            { label: 'GitHub', url: 'https://github.com/kim' },
            { label: '노션', url: 'https://notion.so/kim' },
          ],
        },
      }),
    );
  });

  it('http/https가 아닌 스킴은 저장하지 않는다', async () => {
    const user = userEvent.setup();
    renderMyPage();

    const urlInput = screen.getByLabelText('링크 주소 1');
    await user.clear(urlInput);
    await user.type(urlInput, 'javascript:alert(1)');
    await user.tab();

    expect(mocks.mutateAsync).not.toHaveBeenCalled();
    expect(mocks.error).toHaveBeenCalledWith(
      '링크 주소를 확인해주세요',
      'http:// 또는 https:// 주소만 저장할 수 있어요',
    );
  });

  it('빈 링크 행은 저장하지 않는다', async () => {
    const user = userEvent.setup();
    renderMyPage();

    await user.click(screen.getByRole('button', { name: '링크 추가' }));
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
  });

  it('삭제하면 빈 목록을 저장한다', async () => {
    mocks.mutateAsync.mockResolvedValue({ status: 200 });
    const user = userEvent.setup();
    renderMyPage();

    await user.click(screen.getByRole('button', { name: '링크 1 삭제' }));

    await waitFor(() =>
      expect(mocks.mutateAsync).toHaveBeenCalledWith({ data: { externalLinks: [] } }),
    );
  });

  it('서버 프로필 로딩 전에는 편집을 시작할 수 없다', async () => {
    mocks.meLoaded = false;
    mocks.me.externalLinks = [];
    renderMyPage();

    expect(screen.queryByLabelText('링크 이름 1')).toBeNull();
    expect(screen.queryByRole('button', { name: '링크 추가' })).toBeNull();
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
  });

  it('저장에 실패하면 에러 토스트를 띄운다', async () => {
    mocks.mutateAsync.mockRejectedValue(new Error('boom'));
    const user = userEvent.setup();
    renderMyPage();

    await user.click(screen.getByRole('button', { name: '링크 1 삭제' }));

    await waitFor(() =>
      expect(mocks.error).toHaveBeenCalledWith('저장에 실패했어요', '잠시 후 다시 시도해주세요'),
    );
  });
});

describe('내 프로필 수정 페이지', () => {
  afterEach(cleanup);

  it('링크·뱃지·기술 스택 편집 UI를 보여준다', () => {
    const queryClient = new QueryClient();
    render(
      <ThemeProvider theme={theme}>
        <QueryClientProvider client={queryClient}>
          <MyProfileEditPage />
        </QueryClientProvider>
      </ThemeProvider>,
    );
    expect(screen.getByRole('button', { name: '링크 추가' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '자격증 인증하기' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '기술 스택 추가하기' })).toBeTruthy();
  });
});
