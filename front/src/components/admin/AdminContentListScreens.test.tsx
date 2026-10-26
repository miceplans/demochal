import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@/components/common/Toast';
import { AdminContestListScreen, AdminTeamListScreen } from './AdminContentListScreens';

const mocks = vi.hoisted(() => ({ push: vi.fn(), contents: vi.fn() }));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }));

vi.mock('./AdminShell', () => ({
  useAdminHref: () => (path: string) => `/admin${path}`,
}));

vi.mock('@semochal/api-client', () => ({
  generated: { useListAdminContents: mocks.contents },
}));

vi.mock('./parts', () => ({
  AdminPageTitle: ({ children }: { children: ReactNode }) => <h1>{children}</h1>,
  AdminInlineNotice: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

const teams = [
  {
    id: 'team-1',
    name: '팀 하나',
    challenge: '챌린지 A',
    members: '2/4명 참여중',
    roles: ['기획'],
    otherRoles: ['디자인'],
    unread: true,
  },
  {
    id: 'team-2',
    name: '팀 둘',
    challenge: '챌린지 B',
    members: '1/3명 참여중',
    roles: [],
    otherRoles: ['개발'],
    unread: false,
  },
];

const contests = [
  {
    id: 'contest-1',
    title: '공모전 하나',
    category: 'IT/SW',
    dday: 'D-7',
    teams: '팀 3개',
    unread: true,
  },
];

const loaded = (data: Record<string, unknown>) => ({
  data: { status: 200, data },
  isPending: false,
  isError: false,
  errorUpdatedAt: 0,
});

function renderScreen(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>{ui}</ToastProvider>
    </QueryClientProvider>,
  );
}

describe('AdminTeamListScreen', () => {
  beforeEach(() => {
    mocks.contents.mockReturnValue(
      loaded({ teams, teamsTotal: 2, contests: [], contestsTotal: 0 }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('팀 목록과 총 개수를 표시한다', () => {
    renderScreen(<AdminTeamListScreen />);
    expect(screen.getByText('확인해야하는 팀')).toBeTruthy();
    expect(screen.getByText('총 2팀')).toBeTruthy();
    expect(screen.getByText('팀 하나')).toBeTruthy();
    expect(screen.getByText('팀 둘')).toBeTruthy();
  });

  it('팀 카드 클릭 시 팀 상세로 이동한다', async () => {
    const user = userEvent.setup();
    renderScreen(<AdminTeamListScreen />);
    await user.click(screen.getByRole('button', { name: '팀 하나 상세 보기' }));
    expect(mocks.push).toHaveBeenCalledWith('/admin/contents/teams/team-1');
  });

  it('팀이 없으면 안내 문구를 표시한다', () => {
    mocks.contents.mockReturnValue(
      loaded({ teams: [], teamsTotal: 0, contests: [], contestsTotal: 0 }),
    );
    renderScreen(<AdminTeamListScreen />);
    expect(screen.getByText('확인할 팀이 없어요.')).toBeTruthy();
  });

  it('이전 버튼으로 콘텐츠 모니터링으로 돌아간다', async () => {
    const user = userEvent.setup();
    renderScreen(<AdminTeamListScreen />);
    await user.click(screen.getByRole('button', { name: /이전/ }));
    expect(mocks.push).toHaveBeenCalledWith('/admin/contents');
  });
});

describe('AdminContestListScreen', () => {
  beforeEach(() => {
    mocks.contents.mockReturnValue(
      loaded({ teams: [], teamsTotal: 0, contests, contestsTotal: 1 }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('챌린지 목록과 총 개수를 표시한다', () => {
    renderScreen(<AdminContestListScreen />);
    expect(screen.getByText('확인해야하는 챌린지')).toBeTruthy();
    expect(screen.getByText('총 1개')).toBeTruthy();
    expect(screen.getByText('공모전 하나')).toBeTruthy();
  });

  it('챌린지 카드 클릭 시 챌린지 상세로 이동한다', async () => {
    const user = userEvent.setup();
    renderScreen(<AdminContestListScreen />);
    await user.click(screen.getByRole('button', { name: '공모전 하나 상세 보기' }));
    expect(mocks.push).toHaveBeenCalledWith('/admin/contents/challenges/contest-1');
  });

  it('챌린지가 없으면 안내 문구를 표시한다', () => {
    mocks.contents.mockReturnValue(
      loaded({ teams: [], teamsTotal: 0, contests: [], contestsTotal: 0 }),
    );
    renderScreen(<AdminContestListScreen />);
    expect(screen.getByText('확인할 챌린지가 없어요.')).toBeTruthy();
  });
});
