import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@/components/common/Toast';
import { AdminTeamDetailScreen } from './AdminContentDetailScreen';

const mocks = vi.hoisted(() => ({
  teamDetail: vi.fn(),
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
    useListAdminContents: mocks.contents,
    useRejectAdminTeam: mocks.reject,
    useConfirmAdminTeam: mocks.confirm,
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
});
