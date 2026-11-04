import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PeopleBanners } from './PeopleBanners';

// jsdom에는 scrollIntoView가 없어 클릭 시 스크롤 동작을 검증하도록 stub한다.
const scrollIntoView = vi.fn();

function mockReducedMotion(matches: boolean) {
  vi.stubGlobal('matchMedia', () => ({ matches }));
}

function mountRecommendedSection() {
  const target = document.createElement('div');
  target.id = 'recommended-people';
  document.body.appendChild(target);
}

describe('PeopleBanners', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = scrollIntoView;
    scrollIntoView.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    document.getElementById('recommended-people')?.remove();
  });

  it('"지금 사용하기"는 앵커가 아니라 type="button" 버튼으로 렌더링된다', () => {
    render(<PeopleBanners />);
    const button = screen.getByRole('button', { name: '지금 사용하기' });
    expect(button.tagName).toBe('BUTTON');
    expect(button.getAttribute('type')).toBe('button');
    expect(button.hasAttribute('href')).toBe(false);
  });

  it('클릭하면 recommended-people 섹션으로 스무스 스크롤하고 URL 해시는 바뀌지 않는다', async () => {
    mountRecommendedSection();
    mockReducedMotion(false);
    const user = userEvent.setup();
    render(<PeopleBanners />);
    await user.click(screen.getByRole('button', { name: '지금 사용하기' }));
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' });
    expect(window.location.hash).toBe('');
  });

  it('prefers-reduced-motion이면 스크롤 애니메이션 없이 즉시 이동한다', async () => {
    mountRecommendedSection();
    mockReducedMotion(true);
    const user = userEvent.setup();
    render(<PeopleBanners />);
    await user.click(screen.getByRole('button', { name: '지금 사용하기' }));
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto' });
  });

  it('대상 섹션이 없으면 에러 없이 동작하지 않는다', async () => {
    mockReducedMotion(false);
    const user = userEvent.setup();
    render(<PeopleBanners />);
    await user.click(screen.getByRole('button', { name: '지금 사용하기' }));
    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});
