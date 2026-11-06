import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@/components/common/Toast';
import { AdminChallengeDetailScreen, AdminTeamDetailScreen } from './AdminContentDetailScreen';

const mocks = vi.hoisted(() => ({
  teamDetail: vi.fn(),
  challengeDetail: vi.fn(),
  contents: vi.fn(),
  reject: vi.fn(),
  confirm: vi.fn(),
  push: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('./AdminShell', () => ({ useAdminHref: () => (path: string) => `/admin${path}` }));

vi.mock('./parts', () => ({
  AdminInlineNotice: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ApproveButton: ({ children, ...props }: React.ComponentProps<'button'>) => (
    <button {...props}>{children}</button>
  ),
  RejectButton: ({ children, ...props }: React.ComponentProps<'button'>) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock('@semochal/api-client', () => ({
  generated: {
    useGetAdminTeamDetail: mocks.teamDetail,
    useGetAdminChallengeDetail: mocks.challengeDetail,
    useListAdminContents: mocks.contents,
    useRejectAdminTeam: mocks.reject,
    useConfirmAdminTeam: mocks.confirm,
    useRejectAdminChallenge: mocks.reject,
    useConfirmAdminChallenge: mocks.confirm,
    getListAdminContentsQueryKey: vi.fn(),
    getListAdminReportsQueryKey: vi.fn(),
    getGetAdminTeamDetailQueryKey: vi.fn(),
    getGetAdminChallengeDetailQueryKey: vi.fn(),
  },
}));

const loaded = (data: Record<string, unknown>) => ({
  data: { status: 200, data },
  isPending: false,
});

function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <AdminTeamDetailScreen id="team-1" />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

function renderChallengeScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <AdminChallengeDetailScreen id="challenge-1" />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe('AdminTeamDetailScreen 참여 팀원', () => {
  beforeEach(() => {
    mocks.teamDetail.mockReturnValue(
      loaded({
        id: 'team-1',
        name: '세모 팀',
        challenge: '세모 챌린지',
        leaderName: '팀장',
        members: [
          { name: '가나다', role: '기획' },
          { name: '라마바', role: '' },
        ],
      }),
    );
    mocks.contents.mockReturnValue(loaded({ teams: [], contests: [] }));
    mocks.reject.mockReturnValue({ isPending: false, mutate: vi.fn() });
    mocks.confirm.mockReturnValue({ isPending: false, mutate: vi.fn() });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('수락된 팀원을 이름과 역할 열의 표 행으로 표시한다', () => {
    renderScreen();

    const table = screen.getByRole('table', { name: '참여 팀원' });
    expect(within(table).getByRole('columnheader', { name: '이름' })).toBeTruthy();
    expect(within(table).getByRole('columnheader', { name: '역할' })).toBeTruthy();

    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(3);
    expect(within(rows[1]!).getByRole('cell', { name: '가나다' })).toBeTruthy();
    expect(within(rows[1]!).getByRole('cell', { name: '기획' })).toBeTruthy();
    expect(within(rows[2]!).getByRole('cell', { name: '라마바' })).toBeTruthy();
    expect(within(rows[2]!).getAllByRole('cell')).toHaveLength(2);
  });

  it('참여 팀원이 없으면 기존 안내 문구를 표시한다', () => {
    mocks.teamDetail.mockReturnValue(
      loaded({
        id: 'team-1',
        name: '세모 팀',
        challenge: '세모 챌린지',
        leaderName: '팀장',
        members: [],
      }),
    );

    renderScreen();

    const membersSection = screen.getByText('참여 팀원').parentElement!;
    expect(within(membersSection).getByText('작성되지 않았어요')).toBeTruthy();
    expect(screen.queryByRole('table', { name: '참여 팀원' })).toBeNull();
  });

  it('단일 정보 탭을 누를 수 없는 탭 버튼이 아닌 정적 라벨로 표시한다', () => {
    renderScreen();

    // 팀 상세에는 탭이 하나뿐이라 전환 기능이 없다 — 반응 없는 탭 버튼을 남기지 않는다.
    expect(screen.queryByRole('tab')).toBeNull();
    expect(screen.getByText('정보')).toBeTruthy();
  });
});

describe('AdminChallengeDetailScreen 다음 공모전 분야', () => {
  beforeEach(() => {
    mocks.challengeDetail.mockReturnValue(
      loaded({
        id: 'challenge-1',
        title: '현재 공모전',
        organization: '세모챌',
        startDate: '2026-11-01',
        endDate: '2026-11-30',
      }),
    );
    mocks.contents.mockReturnValue(
      loaded({
        teams: [],
        contests: [
          {
            id: 'challenge-2',
            title: '복수 분야 공모전',
            category: '아이디어·창업, 마케팅',
            dday: 'D-3',
            teams: '팀 2',
          },
        ],
      }),
    );
    mocks.reject.mockReturnValue({ isPending: false, mutate: vi.fn() });
    mocks.confirm.mockReturnValue({ isPending: false, mutate: vi.fn() });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('복수 분야를 각각의 둥근 태그로 표시한다', () => {
    renderChallengeScreen();

    const categoryTags = screen.getByLabelText('분야');
    expect(within(categoryTags).getByText('아이디어')).toBeTruthy();
    expect(within(categoryTags).getByText('창업')).toBeTruthy();
    expect(within(categoryTags).getByText('마케팅')).toBeTruthy();
    expect(within(categoryTags).queryByText('아이디어·창업, 마케팅')).toBeNull();
    expect(screen.getByText('D-3')).toBeTruthy();
    expect(screen.getByText('팀 2')).toBeTruthy();
  });
});
