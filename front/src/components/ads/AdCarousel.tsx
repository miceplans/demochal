'use client';

import { useEffect, useState, type TransitionEvent } from 'react';
import Image from 'next/image';
import styled from '@emotion/styled';
import { colors as c, mobile } from '@/styles/design';

export type AdCarouselItem = {
  alt: string;
  src: string;
};

type AdCarouselProps = {
  ariaLabel: string;
  items: AdCarouselItem[];
  variant: 'hero' | 'gallery';
  interval?: number;
  priceOverlay?: { label: string; value: string };
};

const HeroViewport = styled.div({
  position: 'relative',
  overflow: 'hidden',
  height: '252px',
  '& img': {
    width: '1059px',
    height: '252px',
    borderRadius: '12px',
    objectFit: 'cover',
    flexShrink: 0,
  },
  [mobile]: { display: 'none' },
});

const PriceOverlay = styled.div({
  position: 'absolute',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'flex-end',
  padding: '20px',
  borderRadius: '12px',
  background: 'linear-gradient(to bottom, rgba(255,255,255,0) 0%, #fff 100%)',
  pointerEvents: 'none',
});
const PriceOverlayLabel = styled.p({
  margin: 0,
  fontFamily: 'Pretendard',
  fontSize: '24px',
  fontWeight: 400,
  color: '#101010',
});
const PriceOverlayValue = styled.p({
  margin: 0,
  fontFamily: 'Pretendard',
  fontSize: '48px',
  fontWeight: 600,
  letterSpacing: '-0.49px',
  color: '#101010',
});

const GalleryViewport = styled.div({
  position: 'relative',
  overflow: 'hidden',
  margin: '60px 0',
  padding: '0 calc((100% - 315px) / 2)',
  '& img': {
    width: '315px',
    height: '190px',
    borderRadius: '8px',
    objectFit: 'cover',
    flexShrink: 0,
  },
  [mobile]: {
    margin: '32px 0',
    padding: '0 16px',
    '& img': { width: '122px', height: '74px', borderRadius: '3px' },
  },
});

const Rail = styled.div<{ activeIndex: number; variant: AdCarouselProps['variant'] }>(
  ({ activeIndex, variant }) => {
    const gap = variant === 'hero' ? 60 : 32;
    const width = variant === 'hero' ? 1059 : 315;

    return {
      display: 'flex',
      gap: `${gap}px`,
      transform:
        variant === 'hero'
          ? `translateX(calc(50vw - ${width / 2}px - ${activeIndex * (width + gap)}px))`
          : `translateX(${-activeIndex * (width + gap)}px)`,
      transition: 'transform 0.5s ease-in-out',
      [mobile]:
        variant === 'gallery'
          ? { gap: '12px', transform: `translateX(${-activeIndex * 134}px)` }
          : undefined,
    };
  },
);

const SlideButton = styled.button({
  display: 'block',
  flex: '0 0 auto',
  padding: 0,
  border: 0,
  borderRadius: 'inherit',
  background: 'transparent',
  cursor: 'pointer',
  '&:focus-visible': { outline: `3px solid ${c.primary}`, outlineOffset: '3px' },
});

// hero는 화면 중앙(50vw)에 놓인 1059px 슬라이드의 가장자리에서 20px 안쪽,
// gallery는 뷰포트 중앙의 315px 슬라이드에서 좌우로 12px + 버튼 너비만큼 바깥에 버튼을 둡니다.
const navOffset = {
  hero: 'calc(50vw - 509.5px)',
  gallery: 'calc(50% - 213.5px)',
} as const;

const NavButton = styled.button<{
  direction: 'prev' | 'next';
  variant: AdCarouselProps['variant'];
}>(({ direction, variant }) => ({
  position: 'absolute',
  top: '50%',
  zIndex: 1,
  display: 'grid',
  placeItems: 'center',
  width: '44px',
  height: '44px',
  padding: 0,
  border: 0,
  borderRadius: '50%',
  background: 'rgba(255, 255, 255, 0.85)',
  boxShadow: '0 4px 12px rgba(27, 33, 44, 0.16)',
  cursor: 'pointer',
  transform: 'translateY(-50%)',
  [direction === 'prev' ? 'left' : 'right']: navOffset[variant],
  '& svg': { transition: 'transform 0.15s ease' },
  '&:hover svg': { transform: 'scale(1.15)' },
  '&:focus-visible': { outline: `3px solid ${c.primary}`, outlineOffset: '3px' },
  ...(variant === 'gallery' && {
    [mobile]: {
      width: '32px',
      height: '32px',
      ...(direction === 'prev' ? { left: '0px' } : { right: '0px' }),
    },
  }),
}));

function ArrowIcon({ direction }: { direction: 'prev' | 'next' }) {
  return (
    <svg width="16" height="16" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d={direction === 'prev' ? 'M9 3.5 5.5 7 9 10.5' : 'M5 3.5 8.5 7 5 10.5'}
        stroke={c.gray700}
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 홈의 상단·중간 광고에 공통으로 쓰는 자동 순환 광고 캐러셀입니다. */
export function AdCarousel({
  ariaLabel,
  items,
  variant,
  interval = 5000,
  priceOverlay,
}: AdCarouselProps) {
  const [railIndex, setRailIndex] = useState(1);
  const [shouldAnimate, setShouldAnimate] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const itemCount = items.length;

  useEffect(() => {
    if (isPaused || itemCount < 2) return;
    const timer = window.setInterval(() => {
      setRailIndex((index) => index + 1);
    }, interval);
    return () => window.clearInterval(timer);
  }, [interval, isPaused, itemCount]);

  if (itemCount === 0) return null;

  const slides = [items[itemCount - 1], ...items, items[0]];
  const Viewport = variant === 'hero' ? HeroViewport : GalleryViewport;
  const goTo = (index: number) => {
    setShouldAnimate(true);
    setRailIndex(index + 1);
  };
  // 전환이 끝나기 전 연속 클릭으로 복제 슬라이드 범위(0 ~ itemCount + 1)를 벗어나 그릴
  // 슬라이드가 없어지지 않도록 이동 가능한 rail 위치를 경계로 가둡니다.
  const goToRail = (rail: number) => {
    if (rail < 0 || rail > itemCount + 1) return;
    setShouldAnimate(true);
    setRailIndex(rail);
  };
  const goToPrev = () => goToRail(railIndex - 1);
  const goToNext = () => goToRail(railIndex + 1);

  const handleTransitionEnd = (event: TransitionEvent<HTMLDivElement>) => {
    // 내부 요소(버튼 등)의 transitionend가 버블링되어 레일 위치를 건드리지 않도록 막습니다.
    if (event.target !== event.currentTarget || event.propertyName !== 'transform') return;
    if (railIndex !== 0 && railIndex !== itemCount + 1) return;
    setShouldAnimate(false);
    setRailIndex(railIndex === 0 ? itemCount : 1);
    // 복제한 광고로 이동한 뒤, 애니메이션 없이 실제 광고로 되돌립니다.
    // 두 프레임을 분리해야 브라우저가 되돌아가는 위치를 화면에 그리지 않습니다.
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setShouldAnimate(true));
    });
  };

  return (
    <section
      aria-label={ariaLabel}
      style={priceOverlay ? { pointerEvents: 'auto' } : undefined}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsPaused(false);
      }}
    >
      <Viewport>
        <Rail
          activeIndex={railIndex}
          variant={variant}
          style={{ transition: shouldAnimate ? undefined : 'none' }}
          onTransitionEnd={handleTransitionEnd}
        >
          {slides.map((item, index) => (
            <SlideButton
              key={`${item.src}-${index}`}
              type="button"
              onClick={() => goTo((index - 1 + itemCount) % itemCount)}
            >
              <Image
                src={item.src}
                alt={index === railIndex ? item.alt : ''}
                width={variant === 'hero' ? 1059 : 315}
                height={variant === 'hero' ? 252 : 190}
              />
            </SlideButton>
          ))}
        </Rail>
        {itemCount > 1 ? (
          <>
            <NavButton
              type="button"
              variant={variant}
              direction="prev"
              onClick={goToPrev}
              aria-label="이전 광고"
            >
              <ArrowIcon direction="prev" />
            </NavButton>
            <NavButton
              type="button"
              variant={variant}
              direction="next"
              onClick={goToNext}
              aria-label="다음 광고"
            >
              <ArrowIcon direction="next" />
            </NavButton>
          </>
        ) : null}
        {variant === 'hero' && priceOverlay ? (
          <PriceOverlay>
            <PriceOverlayLabel>{priceOverlay.label}</PriceOverlayLabel>
            <PriceOverlayValue>{priceOverlay.value}</PriceOverlayValue>
          </PriceOverlay>
        ) : null}
      </Viewport>
    </section>
  );
}
