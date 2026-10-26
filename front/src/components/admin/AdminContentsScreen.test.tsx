import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@/components/common/Toast';
import { AdminContentsScreen } from './AdminContentsScreen';

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
  AdminSectionTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  AdminInlineNotice: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  FilterBar: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SearchFilter: () => <input aria-label="콘텐츠명 검색" />,
  SelectFilter: () => <select aria-label="종류" />,
  SectionHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('./ReportLogTable', () => ({ ReportLogTable: () => <div /> }));
vi.mock('@/components/ui/ScrollRail', () => ({
  ScrollRail: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

const teams = [
  {
    id: 'team-1',
    name: '팀 하나',
    challenge: '챌린지 A',
    members: '2/4명 참여중',
    roles: ['기획'],
    otherRoles: ['디자인'],
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
    unread: false,
  },
];

const loaded = (data: Record<string, unknown>) => ({
  data: { status: 200, data },
  isPending: false,
  isError: false,
  errorUpdatedAt: 0,
});

function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <AdminContentsScreen />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe('AdminContentsScreen 더보기', () => {
  beforeEach(() => {
    mocks.contents.mockReturnValue(loaded({ teams, teamsTotal: 3, contests, contestsTotal: 4 }));
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('팀 더보기를 누륾면 팀 목록 페이지로 이동한다', async () => {
    const user = userEvent.setup();
    renderScreen();
    await user.click(screen.getByRole('button', { name: '더보기 (1/3) →' }));
    expect(mocks.push).toHaveBeenCalledWith('/admin/contents/teams');
  });

  it('챌린지 더보기를 누륾면 챌린지 목록 페이지로 이동한다', async () => {
    const user = userEvent.setup();
    renderScreen();
    await user.click(screen.getByRole('button', { name: '더보기 (1/4) →' }));
    expect(mocks.push).toHaveBeenCalledWith('/admin/contents/challenges');
  });

  it('전체를 다 불러왔으면 더보기를 숨긴다', () => {
    mocks.contents.mockReturnValue(loaded({ teams, teamsTotal: 1, contests, contestsTotal: 1 }));
    renderScreen();
    expect(screen.queryByRole('button', { name: /더보기/ })).toBeNull();
  });
});
