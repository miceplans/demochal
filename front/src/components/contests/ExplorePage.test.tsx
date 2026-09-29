import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { generated } from '@semochal/api-client';
import { ExplorePage } from './ExplorePage';

vi.mock('@/components/common/UserShell', () => ({
  UserShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/common/Primitives', () => {
  const Passthrough = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  return {
    Button: ({ children }: { children: ReactNode }) => <button>{children}</button>,
    DesktopOnly: Passthrough,
    MobileOnly: Passthrough,
    Select: () => <select />,
    Row: Passthrough,
    Heading: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
    EmptyState: () => <div data-testid="empty-state" />,
  };
});

vi.mock('@/components/ui/Dropdown', () => ({ Dropdown: () => <select /> }));
vi.mock('@/components/ui/RangeSlider', () => ({ RangeSlider: () => <div /> }));
vi.mock('./ExploreFilters', () => ({
  Checkbox: ({ label }: { label: string }) => <label>{label}</label>,
  CheckFilter: () => <div />,
  ChipFilter: () => <div />,
  FilterGroup: ({ title, children }: { title: string; children: ReactNode }) => (
    <section>
      <h3>{title}</h3>
      {children}
    </section>
  ),
  toggleValue: (values: string[], value: string) => [...values, value],
}));
vi.mock('./ContestCard', () => ({
  ContestCard: ({ contest }: { contest: { title: string } }) => (
    <article data-testid="contest-card">{contest.title}</article>
  ),
  ContestGrid: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/teams/TeamCard', () => ({
  TeamCard: ({ team }: { team: { name: string } }) => (
    <article data-testid="team-card">{team.name}</article>
  ),
  TeamGrid: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@semochal/api-client', () => ({
  generated: {
    useListChallenges: vi.fn(),
    useListTeams: vi.fn(),
  },
}));

function setQueries({
  challengesPending = false,
  challengesSuccess = true,
  challengeItems = [],
  teamsPending = false,
  teamsSuccess = true,
  teamItems = [],
}: {
  challengesPending?: boolean;
  challengesSuccess?: boolean;
  challengeItems?: unknown[];
  teamsPending?: boolean;
  teamsSuccess?: boolean;
  teamItems?: unknown[];
} = {}) {
  vi.mocked(generated.useListChallenges).mockReturnValue({
    isPending: challengesPending,
    isSuccess: challengesSuccess,
    data: { data: { items: challengeItems, nextCursor: null } },
  } as never);
  vi.mocked(generated.useListTeams).mockReturnValue({
    isPending: teamsPending,
    isSuccess: teamsSuccess,
    data: { data: teamItems },
  } as never);
}

describe('ExplorePage loading skeletons', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => cleanup());

  it('shows team-shaped skeleton cards while team results are pending', () => {
    setQueries({ teamsPending: true, teamsSuccess: false });

    render(<ExplorePage teamMode />);

    const status = screen.getByRole('status', { name: '팀 모집글을 불러오는 중입니다' });
    expect(within(status).getAllByRole('article', { hidden: true })).toHaveLength(6);
    expect(screen.queryByTestId('empty-state')).toBeNull();
  });

  it('shows contest-shaped skeleton cards while contest results are pending', () => {
    setQueries({ challengesPending: true, challengesSuccess: false });

    render(<ExplorePage />);

    const status = screen.getByRole('status', { name: '공모전 목록을 불러오는 중입니다' });
    expect(within(status).getAllByRole('article', { hidden: true })).toHaveLength(12);
    expect(screen.queryByTestId('empty-state')).toBeNull();
  });

  it('replaces team skeletons with the empty state illustration on success', () => {
    setQueries({ teamsSuccess: true, teamItems: [] });

    render(<ExplorePage teamMode />);

    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByTestId('empty-state')).not.toBeNull();
  });

  it('replaces contest skeletons with the empty state illustration on success', () => {
    setQueries({ challengesSuccess: true, challengeItems: [] });

    render(<ExplorePage />);

    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByTestId('empty-state')).not.toBeNull();
  });
});
