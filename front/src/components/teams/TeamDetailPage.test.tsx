import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@emotion/react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { theme } from '@/styles/theme';
import { writeFormDraft } from '@/lib/form-draft';
import { TeamDetailPage } from './TeamDetailPage';

const mocks = vi.hoisted(() => ({
  join: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  push: vi.fn(),
  me: undefined as Record<string, unknown> | undefined,
  team: undefined as Record<string, unknown> | undefined,
  challenge: undefined as Record<string, unknown> | undefined,
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'team-1' }),
  usePathname: () => '/teams/team-1',
  useRouter: () => ({ push: mocks.push }),
}));
vi.mock('@/components/common/UserShell', () => ({
  UserShell: ({ children }: { children: ReactNode }) => (
    <ThemeProvider theme={theme}>{children}</ThemeProvider>
  ),
  Content: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/common/Toast', () => ({
  useToast: () => ({ success: mocks.success, error: mocks.error }),
}));
vi.mock('@/features/bookmarks/useBookmarks', () => ({
  isBookmarkableId: () => false,
  useBookmarks: () => ({ bookmarks: [], toggleBookmark: vi.fn(), isToggling: false }),
}));
vi.mock('@/components/common/ShareMenu', () => ({ ShareMenu: () => null }));
// jsdom은 <dialog>의 showModal을 구현하지 않아 열림 상태만 흉낸다.
vi.mock('@/components/common/Feedback', () => ({
  Modal: ({ open, title, children }: { open: boolean; title: string; children: ReactNode }) =>
    open ? (
      <div role="dialog" aria-label={title}>
        {children}
      </div>
    ) : null,
}));
vi.mock('@semochal/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@semochal/api-client')>()),
  generated: {
    useGetMyAuthInfo: () => ({
      data: mocks.me ? { status: 200, data: mocks.me } : undefined,
      isPending: false,
    }),
    useGetTeam: () => ({
      data: mocks.team ? { status: 200, data: mocks.team } : undefined,
      isPending: !mocks.team,
    }),
    useGetChallenge: () => ({
      data: mocks.challenge ? { status: 200, data: mocks.challenge } : undefined,
      isPending: false,
    }),
    useJoinTeam: (options?: {
      mutation?: { onSuccess?: () => void; onError?: (error: unknown) => void };
    }) => ({
      mutate: (variables: unknown) => {
        mocks.join(variables);
        options?.mutation?.onSuccess?.();
      },
      isPending: false,
    }),
    getGetTeamQueryKey: () => ['team'],
  },
}));

const team = {
  id: 'team-1',
  challengeId: 'challenge-1',
  challengeTitle: '2026 AI 챌린지',
  leaderUserId: 'leader-1',
  title: '세모 팀',
  introduction: '함께할 팀원을 모아요',
  openRoles: [{ role: '백엔드', count: 2 }],
  members: [],
  preferred: '',
  etc: '',
  region: '서울',
};
const challenge = {
  id: 'challenge-1',
  title: '2026 AI 챌린지',
  posterUrl: null,
  endDate: '2026-12-31',
  applicationForm: [{ id: 'q1', title: '지원 동기', type: 'short', required: true, options: [] }],
};

const applyDraftStorageKey = 'semochal:form-draft:v1:team-apply:team-1';
const readStoredApplyDraft = () => {
  const raw = localStorage.getItem(applyDraftStorageKey);
  return raw ? (JSON.parse(raw) as { value: unknown }).value : null;
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TeamDetailPage />
    </QueryClientProvider>,
  );
}

describe('TeamDetailPage 지원서 초안', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mocks.me = { id: 'user-1', name: '홍길동' };
    mocks.team = team;
    mocks.challenge = challenge;
  });
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('모달을 열 때 작성하다 만 초안이 있으면 복원한다', async () => {
    writeFormDraft('team-apply:team-1', { role: '백엔드', answers: { q1: '초안 답변' } });
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: '팀 신청하기' }));

    expect(screen.getByRole('dialog', { name: '팀 지원서' })).toBeTruthy();
    expect(screen.getByLabelText('지원 동기')).toHaveProperty('value', '초안 답변');
  });

  it('모달에 입력한 내용을 초안으로 저장하고, 닫았다 다시 열어도 복원한다', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: '팀 신청하기' }));
    await user.type(screen.getByLabelText('지원 동기'), '작성 중인 답변');
    // 디바운스(500ms)가 지나면 초안이 저장된다.
    await waitFor(() => expect(readStoredApplyDraft()).not.toBeNull(), { timeout: 2000 });
    expect(readStoredApplyDraft()).toEqual({ role: '', answers: { q1: '작성 중인 답변' } });

    await user.click(screen.getByRole('button', { name: '취소' }));
    expect(screen.queryByRole('dialog')).toBeNull();

    await user.click(screen.getByRole('button', { name: '팀 신청하기' }));
    expect(screen.getByLabelText('지원 동기')).toHaveProperty('value', '작성 중인 답변');
  });

  it('팀 신청에 성공하면 초안을 지운다', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: '팀 신청하기' }));
    await user.type(screen.getByLabelText('지원 동기'), '지원합니다');
    await user.click(screen.getByRole('button', { name: '신청하기' }));

    expect(mocks.join).toHaveBeenCalledWith({
      id: 'team-1',
      data: {
        role: '백엔드',
        formAnswers: [{ questionId: 'q1', value: '지원합니다' }],
      },
    });
    await waitFor(() => expect(mocks.success).toHaveBeenCalled());
    // 지워진 초안이 남은 디바운스 타이머로 다시 쓰이지 않는지까지 본다.
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(readStoredApplyDraft()).toBeNull();
  });
});
