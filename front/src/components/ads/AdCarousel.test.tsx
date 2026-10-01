import { act, cleanup, render } from '@testing-library/react';
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
});
