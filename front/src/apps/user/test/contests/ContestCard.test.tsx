import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ContestCard } from '../../components/contests/ContestCard';

vi.mock('@/apps/user/hooks/useBookmarks', () => ({
  isBookmarkableId: () => true,
  useBookmarks: () => ({ bookmarks: [], toggleBookmark: vi.fn(), isToggling: false }),
}));

describe('ContestCard poster link', () => {
  afterEach(cleanup);

  it('uses a block detail link so the mobile poster can fill the card width', () => {
    render(
      <ContestCard
        contest={{
          id: 'contest-1',
          title: '모바일 포스터 테스트',
          category: '디자인',
          days: 3,
          posterUrl: '/poster.png',
        }}
        href="/contests/contest-1"
      />,
    );

    const posterLink = screen.getByRole('link', { name: '모바일 포스터 테스트 상세' });
    expect(posterLink).toBeTruthy();
    expect(getComputedStyle(posterLink).display).toBe('block');
  });

  it('썸네일 URL이 있으면 썸네일을, 없으면 포스터를 폰백으로 보여준다', () => {
    const base = {
      id: 'contest-1',
      title: '썸네일 테스트',
      category: '디자인',
      days: 3,
      posterUrl: '/poster.png',
    };
    const { container, unmount } = render(
      <ContestCard contest={base} href="/contests/contest-1" />,
    );
    expect(container.querySelector('.artwork img')?.getAttribute('src')).toBe('/poster.png');
    unmount();

    const second = render(
      <ContestCard contest={{ ...base, thumbnailUrl: '/thumb.webp' }} href="/contests/contest-1" />,
    );
    expect(second.container.querySelector('.artwork img')?.getAttribute('src')).toBe('/thumb.webp');
  });

  it('마감된 챌린지에만 마감 안내 문구를 보여준다', () => {
    const base = { id: 'contest-1', title: '마감 테스트', category: '디자인', days: 0 };
    const closed = render(
      <ContestCard contest={{ ...base, closed: true }} href="/contests/contest-1" />,
    );
    expect(screen.getByText('마감된 공고입니다.')).toBeTruthy();
    closed.unmount();

    render(<ContestCard contest={base} href="/contests/contest-1" />);
    expect(screen.queryByText('마감된 공고입니다.')).toBeNull();
  });

  it('복수 분야를 개별 태그로 나눠 표시한다', () => {
    render(
      <ContestCard
        contest={{
          id: 'contest-1',
          title: '복수 분야 테스트',
          category: 'IT/SW, 디자인,,IT/SW',
          days: 3,
        }}
        href="/contests/contest-1"
      />,
    );

    expect(screen.getAllByText('IT/SW')).toHaveLength(1);
    expect(screen.getAllByText('디자인')).toHaveLength(1);
  });
});

describe('ContestCard 기본 상세 링크', () => {
  afterEach(cleanup);

  const base = { title: '링크 테스트', category: '디자인', days: 3 };

  it('href가 없어도 서버 챌린지(UUID)는 실제 상세로 연결해 신청 링크에 challenge id가 실린다', () => {
    const id = '0b6f1c2e-3d4a-4b5c-8d9e-1f2a3b4c5d6e';
    render(<ContestCard contest={{ ...base, id }} />);
    expect(screen.getByRole('link', { name: '링크 테스트 상세' }).getAttribute('href')).toBe(
      `/contests/${id}`,
    );
  });

  it('href가 없고 목데이터 id면 데모 상세로 연결한다', () => {
    render(<ContestCard contest={{ ...base, id: 'contest-1' }} />);
    expect(screen.getByRole('link', { name: '링크 테스트 상세' }).getAttribute('href')).toBe(
      '/contests/public-data',
    );
  });
});
