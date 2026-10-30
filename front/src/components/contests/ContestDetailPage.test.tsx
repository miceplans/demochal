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
    Button: ({ children, disabled }: { children?: ReactNode; disabled?: boolean }) => (
      <button disabled={disabled}>{children}</button>
    ),
    DesktopOnly: Passthrough,
    MobileOnly: () => null,
    Row: Passthrough,
    Stack: Passthrough,
    Muted: Passthrough,
    Title: Passthrough,
    Tag: Passthrough,
    Icon: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
    IconButton: Passthrough,
    HeartIcon: () => null,
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
  businessId: '7d1c239a-1111-4222-8333-944455556666',
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

describe('ContestDetailPage 상세 포스터 소스', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    observers = [];
    setChallengeQueries();
  });

  afterEach(() => cleanup());

  it('thumbnailUrl이 있으면 상단 커버가 크롭 썸네일을 표시한다', () => {
    vi.mocked(generated.useGetChallenge).mockReturnValue({
      data: { status: 200, data: { ...CHALLENGE, thumbnailUrl: '/thumb.webp' } },
    } as never);
    const { container } = render(<ContestDetailPage challengeId={CHALLENGE.id} />);
    expect(container.querySelector('.cover img')?.getAttribute('src')).toBe('/thumb.webp');
  });

  it('thumbnailUrl이 없으면 상단 커버가 원본 posterUrl로 폰백한다', () => {
    const { container } = render(<ContestDetailPage challengeId={CHALLENGE.id} />);
    expect(container.querySelector('.cover img')?.getAttribute('src')).toBe('/poster.png');
  });

  it('사이드바 포스터도 thumbnailUrl을 우선 표시한다', () => {
    vi.mocked(generated.useGetChallenge).mockReturnValue({
      data: { status: 200, data: { ...CHALLENGE, thumbnailUrl: '/thumb.webp' } },
    } as never);
    render(<ContestDetailPage challengeId={CHALLENGE.id} />);
    scrollIntro(false);
    expect(posterAlt()?.getAttribute('src')).toBe('/thumb.webp');
  });

  it('사이드바 포스터는 thumbnailUrl이 없으면 posterUrl로 폰백한다', () => {
    render(<ContestDetailPage challengeId={CHALLENGE.id} />);
    scrollIntro(false);
    expect(posterAlt()?.getAttribute('src')).toBe('/poster.png');
  });
});

describe('ContestDetailPage 기업 프로필 진입점', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    observers = [];
    setChallengeQueries();
  });

  afterEach(() => cleanup());

  it('주최 표시가 등록 기업의 공개 프로필 링크로 연결된다', () => {
    render(<ContestDetailPage challengeId={CHALLENGE.id} />);
    const link = screen.getByRole('link', { name: CHALLENGE.organizer });
    expect(link.getAttribute('href')).toBe(`/businesses/${CHALLENGE.businessId}`);
  });

  it('businessId가 없는 챌린지는 주최가 링크가 아니라 일반 텍스트로 표시된다', () => {
    vi.mocked(generated.useGetChallenge).mockReturnValue({
      data: { status: 200, data: { ...CHALLENGE, businessId: undefined } },
    } as never);
    render(<ContestDetailPage challengeId={CHALLENGE.id} />);
    expect(screen.queryByRole('link', { name: CHALLENGE.organizer })).toBeNull();
    expect(screen.getByText(CHALLENGE.organizer)).not.toBeNull();
  });
});

describe('ContestDetailPage 마감 챌린지 CTA', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    observers = [];
    setChallengeQueries();
  });

  afterEach(() => cleanup());

  it('마감된 챌린지는 신청과 팀 구하기 버튼을 비활성화하고 링크를 렌더하지 않는다', () => {
    vi.mocked(generated.useGetChallenge).mockReturnValue({
      data: { status: 200, data: { ...CHALLENGE, endDate: '2020-10-31' } },
    } as never);
    render(<ContestDetailPage challengeId={CHALLENGE.id} />);

    expect(screen.getByRole('button', { name: '참가 신청하기' }).hasAttribute('disabled')).toBe(
      true,
    );
    expect(
      screen.getByRole('button', { name: '이 챌린지 팀 구하기' }).hasAttribute('disabled'),
    ).toBe(true);
    expect(screen.getByRole('button', { name: '참가 신청하기' }).closest('a')).toBeNull();
    expect(screen.getByRole('button', { name: '이 챌린지 팀 구하기' }).closest('a')).toBeNull();
  });

  it('상태가 closed인 챌린지도 마감일과 무관하게 CTA를 비활성화한다', () => {
    vi.mocked(generated.useGetChallenge).mockReturnValue({
      data: { status: 200, data: { ...CHALLENGE, endDate: '2030-10-31', status: 'closed' } },
    } as never);
    render(<ContestDetailPage challengeId={CHALLENGE.id} />);

    expect(screen.getByRole('button', { name: '참가 신청하기' }).hasAttribute('disabled')).toBe(
      true,
    );
    expect(
      screen.getByRole('button', { name: '이 챌린지 팀 구하기' }).hasAttribute('disabled'),
    ).toBe(true);
  });

  it('마감된 챌린지는 스크롤 후 고정 신청 버튼도 비활성화하고 링크를 렌더하지 않는다', () => {
    vi.mocked(generated.useGetChallenge).mockReturnValue({
      data: { status: 200, data: { ...CHALLENGE, endDate: '2020-10-31' } },
    } as never);
    render(<ContestDetailPage challengeId={CHALLENGE.id} />);
    scrollIntro(false);

    const applyButtons = screen.getAllByRole('button', { name: '참가 신청하기' });
    expect(applyButtons).toHaveLength(2);
    for (const button of applyButtons) {
      expect(button.hasAttribute('disabled')).toBe(true);
      expect(button.closest('a')).toBeNull();
    }
  });

  it('진행 중 챌린지는 신청과 팀 구하기 링크를 유지한다', () => {
    vi.mocked(generated.useGetChallenge).mockReturnValue({
      data: { status: 200, data: { ...CHALLENGE, endDate: '2030-10-31' } },
    } as never);
    render(<ContestDetailPage challengeId={CHALLENGE.id} />);

    expect(screen.getByRole('link', { name: '참가 신청하기' }).getAttribute('href')).toBe(
      `/applications/new?challenge=${CHALLENGE.id}`,
    );
    expect(screen.getByRole('link', { name: '이 챌린지 팀 구하기' }).getAttribute('href')).toBe(
      `/teams/new?challengeId=${CHALLENGE.id}`,
    );
  });
});
