import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AdCarousel,
  getMobileHeroSlideStep,
  HERO_EDGE_FADE_STYLE,
  HERO_MEDIA_STYLE,
  HERO_VIEWPORT_STYLE,
  INACTIVE_OVERLAY_STYLE,
  MOBILE_HERO_LAYOUT,
  MOBILE_HERO_MEDIA_STYLE,
  MOBILE_HERO_VIEWPORT_STYLE,
} from './AdCarousel';

const animation = vi.hoisted(() => ({
  callbacks: new Map<number, FrameRequestCallback>(),
  cancel: vi.fn(),
  nextId: 1,
  request: vi.fn((callback: FrameRequestCallback) => {
    const id = animation.nextId++;
    animation.callbacks.set(id, callback);
    return id;
  }),
}));

class ResizeObserverMock {
  observe() {}
  disconnect() {}
}

class IntersectionObserverMock {
  observe() {}
  disconnect() {}
}

describe('AdCarousel', () => {
  beforeEach(() => {
    animation.cancel.mockClear();
    animation.callbacks.clear();
    animation.nextId = 1;
    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
    vi.stubGlobal('IntersectionObserver', IntersectionObserverMock);
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    vi.stubGlobal('requestAnimationFrame', animation.request);
    vi.stubGlobal('cancelAnimationFrame', animation.cancel);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('cancels a resize-reset animation frame when unmounted', () => {
    const { unmount } = render(
      <AdCarousel
        ariaLabel="홈 상단 광고"
        variant="hero"
        items={[
          { alt: '첫 광고', src: '/first.png' },
          { alt: '두 번째 광고', src: '/second.png' },
        ]}
      />,
    );

    expect(animation.request).toHaveBeenCalledTimes(1);

    unmount();

    expect(animation.cancel).toHaveBeenCalledWith(1);
  });

  it('cancels the second frame after the first frame has run', () => {
    const { unmount } = render(
      <AdCarousel
        ariaLabel="홈 상단 광고"
        variant="hero"
        items={[
          { alt: '첫 광고', src: '/first.png' },
          { alt: '두 번째 광고', src: '/second.png' },
        ]}
      />,
    );

    animation.callbacks.get(1)?.(0);
    unmount();

    expect(animation.cancel).toHaveBeenCalledWith(2);
  });

  it('re-enables animation when the effect re-runs without a pad change', () => {
    const items = [
      { alt: '첫 광고', src: '/first.png' },
      { alt: '두 번째 광고', src: '/second.png' },
    ];
    const { container, rerender } = render(
      <AdCarousel ariaLabel="홈 상단 광고" variant="hero" items={items} />,
    );
    const rail = container.querySelector('button')!.parentElement!;

    // 첫 프레임만 실행해 재활성화 두 번째 프레임을 예약된 상태로 둔다.
    animation.callbacks.get(1)?.(0);
    expect(rail!.style.transition).toBe('none');

    // 광고 리페치 등으로 슬라이드 수가 바뀌어 이펙트가 재실행된다. pad는 그대로라
    // measure가 early-return하므로, 취소된 재활성화 프레임을 다시 예약해야 한다.
    rerender(
      <AdCarousel
        ariaLabel="홈 상단 광고"
        variant="hero"
        items={[...items, { alt: '세 번째 광고', src: '/third.png' }]}
      />,
    );

    expect(animation.cancel).toHaveBeenCalledWith(2);
    expect(rail!.style.transition).toBe('none');

    act(() => {
      animation.callbacks.get(3)?.(0);
      animation.callbacks.get(4)?.(0);
    });

    expect(rail!.style.transition).toBe('');
  });

  it('keeps the design crop styles and movement contract on mobile', () => {
    expect(MOBILE_HERO_LAYOUT).toEqual({ width: 350, height: 100, inset: 0, gap: 0 });
    expect(MOBILE_HERO_LAYOUT.width / MOBILE_HERO_LAYOUT.height).toBe(3.5);
    expect(MOBILE_HERO_VIEWPORT_STYLE).toMatchObject({
      width: '100%',
      aspectRatio: '350 / 100',
    });
    expect(MOBILE_HERO_MEDIA_STYLE).toMatchObject({
      width: 'calc(100vw - 0px)',
      height: 'auto',
      aspectRatio: '350 / 100',
      objectFit: 'cover',
      objectPosition: 'center',
    });
    expect(getMobileHeroSlideStep(358)).toBe(358);
    expect(getMobileHeroSlideStep(480)).toBe(480);
  });

  it('preserves the desktop hero media dimensions and aspect ratio', () => {
    expect(HERO_MEDIA_STYLE).toMatchObject({
      width: '900px',
      height: '257px',
      borderRadius: '12px',
    });
    expect(HERO_VIEWPORT_STYLE).toEqual({ height: '257px' });
    // 폭 1200→900 축소에도 원 노출 비율 1200:343(≈3.5:1)을 유지한다.
    expect(900 / 257).toBeCloseTo(1200 / 343, 2);
  });

  it('fades the desktop hero edges without blocking ad interaction', () => {
    expect(HERO_EDGE_FADE_STYLE).toMatchObject({
      pointerEvents: 'none',
      background: expect.stringContaining('linear-gradient(90deg'),
    });
    expect(HERO_EDGE_FADE_STYLE.background).toContain('transparent 15%');
    expect(HERO_EDGE_FADE_STYLE.background).toContain('transparent 85%');
  });

  it('darkens every slide except the centered active ad and updates after navigation', () => {
    const { container } = render(
      <AdCarousel
        ariaLabel="홈 중간 광고"
        variant="gallery"
        items={[
          { alt: '첫 광고', src: '/first.png' },
          { alt: '두 번째 광고', src: '/second.png' },
        ]}
      />,
    );

    expect(screen.getAllByTestId('inactive-ad-overlay')).toHaveLength(
      container.querySelectorAll('[data-ad-slide]').length - 1,
    );
    expect(container.querySelectorAll('[data-ad-slide][data-active="true"]')).toHaveLength(1);
    expect(
      screen
        .getByAltText('첫 광고')
        .closest('button')
        ?.querySelector('[data-testid="inactive-ad-overlay"]'),
    ).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '다음 광고' }));

    expect(screen.getAllByTestId('inactive-ad-overlay')).toHaveLength(
      container.querySelectorAll('[data-ad-slide]').length - 1,
    );
    expect(container.querySelectorAll('[data-ad-slide][data-active="true"]')).toHaveLength(1);
    expect(
      screen.getByAltText('두 번째 광고').closest('button')?.querySelector('[data-testid]'),
    ).toBe(null);
  });

  it('keeps the inactive overlay visual-only', () => {
    expect(INACTIVE_OVERLAY_STYLE).toEqual({
      pointerEvents: 'none',
      background: 'rgb(0 0 0 / 48%)',
    });
  });

  it('applies the same overlay rule to hero videos and previous navigation', () => {
    const { container } = render(
      <AdCarousel
        ariaLabel="홈 상단 광고"
        variant="hero"
        items={[
          { alt: '첫 영상 광고', src: '/first.webm', type: 'video' },
          { alt: '두 번째 이미지 광고', src: '/second.png' },
        ]}
      />,
    );

    const activeVideo = screen.getByLabelText('첫 영상 광고');
    expect(activeVideo.closest('[data-ad-slide]')?.getAttribute('data-active')).toBe('true');
    expect(activeVideo.closest('[data-ad-slide]')?.querySelector('[data-testid]')).toBeNull();
    expect(screen.getAllByTestId('inactive-ad-overlay')).toHaveLength(
      container.querySelectorAll('[data-ad-slide]').length - 1,
    );

    fireEvent.click(screen.getByRole('button', { name: '이전 광고' }));

    const activeImage = screen.getByAltText('두 번째 이미지 광고');
    expect(activeImage.closest('[data-ad-slide]')?.getAttribute('data-active')).toBe('true');
    expect(activeImage.closest('[data-ad-slide]')?.querySelector('[data-testid]')).toBeNull();
    expect(container.querySelectorAll('[data-ad-slide][data-active="true"]')).toHaveLength(1);
  });
});
