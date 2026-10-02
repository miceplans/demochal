'use client';

import { useCallback, useEffect, useState, type ReactNode, type TransitionEvent } from 'react';

export type MovingAdsState = {
  activeIndex: number;
  isPaused: boolean;
  goTo: (index: number) => void;
  goPrev: () => void;
  goNext: () => void;
  loopIndexes: number[];
  railIndex: number;
  shouldAnimate: boolean;
  handleTransitionEnd: (event: TransitionEvent<HTMLElement>) => void;
};

type MovingAdsProps = {
  ariaLabel: string;
  itemCount: number;
  children: (state: MovingAdsState) => ReactNode;
  interval?: number;
  paused?: boolean;
};

/**
 * 광고 슬롯처럼 일정 간격으로 이동하는 UI를 위한 공통 컨트롤러입니다.
 * 마우스를 올리거나 키보드 포커스가 머무는 동안, 혹은 paused가 true면 자동 이동을 멈춥니다.
 */
export function MovingAds({
  ariaLabel,
  itemCount,
  children,
  interval = 5000,
  paused = false,
}: MovingAdsProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  // 첫·마지막 광고를 복제해 끝에서도 한 방향으로 자연스럽게 이어지게 합니다.
  // 항목이 1개뿐이면 복제본이 없으므로 레일 위치도 0(유일한 슬롯)에서 시작합니다.
  // 슬라이드 수가 바뀌면 호출부에서 key를 바꿔 다시 마운트시켜 이 위치를 재시작합니다.
  const [railIndex, setRailIndex] = useState(() => (itemCount > 1 ? 1 : 0));
  const [shouldAnimate, setShouldAnimate] = useState(true);
  const [isPaused, setIsPaused] = useState(false);

  const goTo = useCallback(
    (index: number) => {
      const nextIndex = ((index % itemCount) + itemCount) % itemCount;
      setShouldAnimate(true);
      setActiveIndex(nextIndex);
      setRailIndex(itemCount > 1 ? nextIndex + 1 : 0);
    },
    [itemCount],
  );

  // 복제본 위치(0, itemCount + 1)에서 되감기 전환이 끝나기 전에는 연속 클릭을 무시합니다.
  const step = useCallback(
    (direction: 1 | -1) => {
      if (itemCount < 2 || railIndex < 1 || railIndex > itemCount) return;
      setShouldAnimate(true);
      setActiveIndex((index) => (index + direction + itemCount) % itemCount);
      setRailIndex(railIndex + direction);
    },
    [itemCount, railIndex],
  );
  const goPrev = useCallback(() => step(-1), [step]);
  const goNext = useCallback(() => step(1), [step]);

  useEffect(() => {
    if (isPaused || paused || itemCount < 2) return;

    const timerId = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % itemCount);
      setRailIndex((index) => index + 1);
    }, interval);

    return () => window.clearInterval(timerId);
  }, [interval, isPaused, paused, itemCount]);

  const handleTransitionEnd = useCallback(
    (event: TransitionEvent<HTMLElement>) => {
      // 카드 hover 등 내부 요소의 transitionend가 버블링되어 레일 위치를 건드리지 않도록 막습니다.
      if (event.target !== event.currentTarget || event.propertyName !== 'transform') return;
      // 항목이 1개뿐이면 복제 경계가 없으므로 레일을 되감지 않습니다.
      if (itemCount < 2) return;
      if (railIndex !== 0 && railIndex !== itemCount + 1) return;

      setShouldAnimate(false);
      setRailIndex(railIndex === 0 ? itemCount : 1);
      window.requestAnimationFrame(() => setShouldAnimate(true));
    },
    [itemCount, railIndex],
  );

  const loopIndexes =
    itemCount > 1
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
      {children({
        activeIndex,
        isPaused,
        goTo,
        goPrev,
        goNext,
        loopIndexes,
        railIndex,
        shouldAnimate,
        handleTransitionEnd,
      })}
    </div>
  );
}
