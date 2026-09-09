'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';

export type MovingAdsState = {
  activeIndex: number;
  isPaused: boolean;
  goTo: (index: number) => void;
  loopIndexes: number[];
  railIndex: number;
  shouldAnimate: boolean;
  handleTransitionEnd: () => void;
};

type MovingAdsProps = {
  ariaLabel: string;
  itemCount: number;
  children: (state: MovingAdsState) => ReactNode;
  interval?: number;
};

/**
 * 광고 슬롯처럼 일정 간격으로 이동하는 UI를 위한 공통 컨트롤러입니다.
 * 마우스를 올리거나 키보드 포커스가 머무는 동안에는 자동 이동을 멈춥니다.
 */
export function MovingAds({
  ariaLabel,
  itemCount,
  children,
  interval = 5000,
}: MovingAdsProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  // 첫·마지막 광고를 복제해 끝에서도 한 방향으로 자연스럽게 이어지게 합니다.
  const [railIndex, setRailIndex] = useState(1);
  const [shouldAnimate, setShouldAnimate] = useState(true);
  const [isPaused, setIsPaused] = useState(false);

  const goTo = useCallback((index: number) => {
    const nextIndex = ((index % itemCount) + itemCount) % itemCount;
    setShouldAnimate(true);
    setActiveIndex(nextIndex);
    setRailIndex(nextIndex + 1);
  }, [itemCount]);

  useEffect(() => {
    if (isPaused || itemCount < 2) return;

    const timerId = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % itemCount);
      setRailIndex((index) => index + 1);
    }, interval);

    return () => window.clearInterval(timerId);
  }, [interval, isPaused, itemCount]);

  const handleTransitionEnd = useCallback(() => {
    if (railIndex !== 0 && railIndex !== itemCount + 1) return;

    setShouldAnimate(false);
    setRailIndex(railIndex === 0 ? itemCount : 1);
    window.requestAnimationFrame(() => setShouldAnimate(true));
  }, [itemCount, railIndex]);

  const loopIndexes = itemCount > 1
    ? [itemCount - 1, ...Array.from({ length: itemCount }, (_, index) => index), 0]
    : [0];

  return (
    <div
      aria-label={ariaLabel}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsPaused(false);
      }}
    >
      {children({ activeIndex, isPaused, goTo, loopIndexes, railIndex, shouldAnimate, handleTransitionEnd })}
    </div>
  );
}
