import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useState, type ReactNode } from 'react';
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

vi.mock('@/components/ui/Dropdown', () => ({
  Dropdown: ({
    options,
    onChange,
    value,
    ...props
  }: {
    options: { value: string; label: string }[];
    onChange?: (value: string) => void;
    value?: string;
    'aria-label'?: string;
  }) => (
    <select
      aria-label={props['aria-label']}
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}));
vi.mock('@/components/ui/RangeSlider', () => ({ RangeSlider: () => <div /> }));
vi.mock('./ExploreFilters', () => ({
  Checkbox: ({ label }: { label: string }) => <label>{label}</label>,
  CheckFilter: () => <div />,
  FilterPopover: ({ label, children }: { label: string; children: ReactNode }) => {
    const [open, setOpen] = useState(false);
    return (
      <div>
        <button type="button" onClick={() => setOpen((v) => !v)}>
          {label}
        </button>
        {open && children}
      </div>
    );
  },
  ChipFilter: ({
    ariaLabel,
    options,
    selected,
    onToggle,
  }: {
    ariaLabel: string;
    options: string[];
    selected: string[];
    onToggle: (value: string) => void;
  }) => (
    <div role="group" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={selected.includes(option)}
          onClick={() => onToggle(option)}
        >
          {option}
        </button>
      ))}
    </div>
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
vi.mock('@semochal/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@semochal/api-client')>();
  return {
    ...actual,
    generated: {
      useListChallenges: vi.fn(),
      useListTeams: vi.fn(),
      useGetChallenge: vi.fn(),
    },
  };
});

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
  vi.mocked(generated.useGetChallenge).mockReturnValue({
    isPending: false,
    data: undefined,
  } as never);
}

class IntersectionObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe('ExplorePage loading skeletons', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // jsdom에는 IntersectionObserver가 없어 필터 바 sentinel 훅이 실패한다.
    vi.stubGlobal('IntersectionObserver', IntersectionObserverStub);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

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

describe('ExplorePage category filters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('IntersectionObserver', IntersectionObserverStub);
    setQueries();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('shows the new categories on desktop and mobile and filters challenges by the selected category', async () => {
    const { container } = render(<ExplorePage />);

    fireEvent.click(screen.getByRole('button', { name: '분야' }));
    const desktopCategoryGroup = screen.getByRole('group', { name: '분야' });
    const mobileCategorySelect =
      container.querySelector<HTMLSelectElement>('select[aria-label="분야"]');
    expect(mobileCategorySelect).not.toBeNull();
    for (const category of ['대외활동', '홍보', '강연/강의']) {
      expect(within(desktopCategoryGroup).getByRole('button', { name: category })).toBeTruthy();
      expect(
        Array.from(mobileCategorySelect!.options).some((option) => option.text === category),
      ).toBe(true);
    }

    fireEvent.click(within(desktopCategoryGroup).getByRole('button', { name: '대외활동' }));
    await waitFor(() => {
      const calls = vi.mocked(generated.useListChallenges).mock.calls;
      expect(calls.at(-1)?.[0]?.category).toBe('대외활동');
    });

    fireEvent.change(mobileCategorySelect!, { target: { value: '홍보' } });
    await waitFor(() => {
      const calls = vi.mocked(generated.useListChallenges).mock.calls;
      expect(calls.at(-1)?.[0]?.category).toBe('홍보');
    });
  });
});
