import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { generated } from '@semochal/api-client';
import { ContestDetailPage } from './ContestDetailPage';

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@/components/common/UserShell', () => ({
  UserShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Content: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/common/Primitives', () => {
  const Passthrough = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return {
    Button: Passthrough,
    DesktopOnly: Passthrough,
    MobileOnly: () => null,
    Row: Passthrough,
    Stack: Passthrough,
    Muted: Passthrough,
    Title: Passthrough,
    Tag: Passthrough,
    Icon: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
    IconButton: Passthrough,
    SectionHeader: ({ title }: { title: string }) => <h2>{title}</h2>,
  };
});

vi.mock('@/components/common/Toast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

vi.mock('@/features/bookmarks/useBookmarks', () => ({
  isBookmarkableId: (id?: string) => Boolean(id),
  useBookmarks: () => ({ bookmarks: [], toggleBookmark: vi.fn(), isToggling: false }),
}));

vi.mock('@semochal/api-client', () => ({
  generated: {
    useGetChallenge: vi.fn(),
    useListTeams: vi.fn(),
    useListSimilarChallenges: vi.fn(),
  },
}));

// jsdom은 IntersectionObserver를 제공하지 않는다 — 관찰 등록을 기록하고 가시성 변화를 수동으로 트리거한다.
type MockObserver = { trigger: (isIntersecting: boolean) => void };
let observers: MockObserver[];

class MockIntersectionObserver {
  constructor(callback: IntersectionObserverCallback) {
    observers.push({
      trigger: (isIntersecting: boolean) => {
        callback(
          [{ isIntersecting } as IntersectionObserverEntry],
          this as unknown as IntersectionObserver,
        );
      },
    });
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);

const CHALLENGE = {
  id: '346b34db-ab07-4ab0-9242-6ed941420506',
  title: '테스트 챌린지',
  organizer: '주최 기관',
  eligibility: '누구나',
  startDate: '2026-10-01',
  endDate: '2026-10-31',
  posterUrl: '/poster.png',
  recruitMethod: 'internal',
  price: 0,
  category: '개발',
  capacity: 4,
  description: '상세 설명',
};

function setChallengeQueries() {
  vi.mocked(generated.useGetChallenge).mockReturnValue({
    data: { status: 200, data: CHALLENGE },
  } as never);
  vi.mocked(generated.useListTeams).mockReturnValue({ data: { data: [] } } as never);
  vi.mocked(generated.useListSimilarChallenges).mockReturnValue({
    data: { status: 200, data: [] },
  } as never);
}

function scrollIntro(introInView: boolean) {
  act(() => {
    for (const observer of observers) observer.trigger(introInView);
  });
}

const posterAlt = () => screen.queryByAltText(`${CHALLENGE.title} 포스터`);

describe('ContestDetailPage 사이드바 포스터', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    observers = [];
    setChallengeQueries();
  });

  afterEach(() => cleanup());

  it('Intro가 화면에 보이면 사이드바에 포스터를 표시하지 않는다', () => {
    render(<ContestDetailPage challengeId={CHALLENGE.id} />);
    expect(posterAlt()).toBeNull();
  });

  it('Intro가 화면에서 사라지면 사이드바에 포스터를 표시한다', () => {
    render(<ContestDetailPage challengeId={CHALLENGE.id} />);
    scrollIntro(false);
    expect(posterAlt()).not.toBeNull();
  });

  it('다시 스크롤해 Intro가 보이면 포스터를 다시 숨긴다', () => {
    render(<ContestDetailPage challengeId={CHALLENGE.id} />);
    scrollIntro(false);
    expect(posterAlt()).not.toBeNull();
    scrollIntro(true);
    expect(posterAlt()).toBeNull();
  });

  it('팀모집 탭에서는 포스터를 표시하지 않는다', () => {
    render(<ContestDetailPage challengeId={CHALLENGE.id} teamTab />);
    scrollIntro(false);
    expect(posterAlt()).toBeNull();
  });
});
