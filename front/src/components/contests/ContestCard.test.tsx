import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ContestCard } from './ContestCard';

vi.mock('@/features/bookmarks/useBookmarks', () => ({
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
    const { unmount } = render(<ContestCard contest={base} href="/contests/contest-1" />);
    expect(screen.getByRole('img', { hidden: true }).getAttribute('src')).toBe('/poster.png');
    unmount();

    render(
      <ContestCard
        contest={{ ...base, thumbnailUrl: '/thumb.webp' }}
        href="/contests/contest-1"
      />,
    );
    expect(screen.getByRole('img', { hidden: true }).getAttribute('src')).toBe('/thumb.webp');
  });
});
