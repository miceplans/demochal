import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@emotion/react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { theme } from '@/styles/theme';
import { ApplicationDetailPage } from './ApplicationDetailPage';

const mocks = vi.hoisted(() => ({
  update: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  meId: 'user-1',
  application: undefined as Record<string, unknown> | undefined,
  challenge: undefined as Record<string, unknown> | undefined,
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/my/applications/app-1',
}));
vi.mock('@/components/common/UserShell', () => ({
  MyShell: ({ children }: { children: ReactNode }) => (
    <ThemeProvider theme={theme}>{children}</ThemeProvider>
  ),
}));
vi.mock('@/components/common/Toast', () => ({
  useToast: () => ({ success: mocks.success, error: mocks.error }),
}));
vi.mock('@semochal/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@semochal/api-client')>()),
  generated: {
    useGetApplication: () => ({
      data: mocks.application ? { status: 200, data: mocks.application } : undefined,
      isPending: !mocks.application,
      isError: false,
    }),
    useGetChallenge: () => ({
      data: mocks.challenge ? { status: 200, data: mocks.challenge } : undefined,
      isPending: false,
      isError: false,
    }),
    useGetMyAuthInfo: () => ({
      data: { status: 200, data: { id: mocks.meId, name: '홍길동' } },
    }),
    useUpdateApplication: () => ({ mutateAsync: mocks.update, isPending: false }),
    getGetApplicationQueryKey: () => ['application'],
    getListMyApplicationsQueryKey: () => ['listMyApplications'],
  },
}));

const questions = [
  { id: 'q1', title: '지원 동기', type: 'short', required: true, options: [] },
  { id: 'q2', title: '포트폴리오', type: 'file', required: false, options: [] },
];
const fileId = '11111111-1111-4111-8111-111111111111';
const application = (status: string) => ({
  id: 'app-1',
  challengeId: 'challenge-1',
  userId: 'user-1',
  status,
  createdAt: '2026-10-01T00:00:00.000Z',
  role: '백엔드',
  teammates: ['홍길동', '김철수'],
  evaluation: 'undecided',
  formAnswers: [
    { questionId: 'q1', title: '지원 동기', type: 'short', value: '열심히 하겠습니다' },
    { questionId: 'q2', title: '포트폴리오', type: 'file', value: [fileId] },
  ],
});
const challenge = {
  title: '2026 AI 챌린지',
  roles: ['백엔드', '프론트엔드'],
  applicationForm: questions,
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ApplicationDetailPage applicationId="app-1" />
    </QueryClientProvider>,
  );
}

describe('ApplicationDetailPage', () => {
  afterEach(() => {
    cleanup();
  });
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.meId = 'user-1';
    mocks.application = application('submitted');
    mocks.challenge = challenge;
    mocks.update.mockResolvedValue({ status: 200, data: mocks.application });
  });

  it('역할/팀원/질문 답변과 첨부파일 열기 버튼을 표시한다', () => {
    renderPage();
    expect(screen.getByText('2026 AI 챌린지')).toBeTruthy();
    expect(screen.getByText('제출 완료')).toBeTruthy();
    expect(screen.getByText('백엔드')).toBeTruthy();
    expect(screen.getByText('홍길동')).toBeTruthy();
    expect(screen.getByText('김철수')).toBeTruthy();
    expect(screen.getByText('지원 동기')).toBeTruthy();
    expect(screen.getByText('열심히 하겠습니다')).toBeTruthy();
    expect(screen.getByRole('button', { name: '첨부파일 열기' })).toBeTruthy();
  });

  it('수정 모드에서 답변을 고쳐 저장하면 useUpdateApplication이 호출되고 읽기 모드로 돌아온다', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: '수정' }));

    // 수정 폼: 역할 드롭다운, 팀원 입력, 질문 답변 입력이 초기값과 함께 열린다.
    expect(screen.getByRole('combobox', { name: '지원 역할' })).toBeTruthy();
    expect(screen.getByLabelText('팀원 1 이름')).toHaveProperty('value', '홍길동');

    const answerInput = screen.getByLabelText('지원 동기');
    expect(answerInput).toHaveProperty('value', '열심히 하겠습니다');
    await user.clear(answerInput);
    await user.type(answerInput, '새로운 답변');
    await user.click(screen.getByRole('button', { name: '저장' }));

    await waitFor(() =>
      expect(mocks.update).toHaveBeenCalledWith({
        id: 'app-1',
        data: {
          role: '백엔드',
          teammates: ['홍길동', '김철수'],
          formAnswers: [
            { questionId: 'q1', value: '새로운 답변' },
            { questionId: 'q2', value: [fileId] },
          ],
        },
      }),
    );
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('지원서를 수정했어요'));
    // 저장 성공 후 수정 폼이 닫히고 읽기 모드로 돌아온다.
    expect(screen.queryByRole('combobox', { name: '지원 역할' })).toBeNull();
    expect(screen.getByRole('button', { name: '수정' })).toBeTruthy();
  });

  it.each(['reviewing', 'accepted', 'rejected'])(
    '상태가 %s이면 수정 버튼이 노출되지 않는다',
    (status) => {
      mocks.application = application(status);
      renderPage();
      expect(screen.queryByRole('button', { name: '수정' })).toBeNull();
      expect(screen.getByText('열심히 하겠습니다')).toBeTruthy();
    },
  );

  it('본인 지원서가 아니면 수정 버튼이 노출되지 않는다', () => {
    mocks.meId = 'other-user';
    renderPage();
    expect(screen.queryByRole('button', { name: '수정' })).toBeNull();
  });
});
