import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdCarousel } from './AdCarousel';

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
});
