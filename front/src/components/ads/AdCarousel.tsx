'use client';

import { useEffect, useState } from 'react';
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
  height: 252,
  '& img': { width: 1059, height: 252, borderRadius: 12, objectFit: 'cover', flexShrink: 0 },
  [mobile]: { display: 'none' },
});

const PriceOverlay = styled.div({
  position: 'absolute',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'flex-end',
  padding: 20,
  borderRadius: 12,
  background: 'linear-gradient(to bottom, rgba(255,255,255,0) 0%, #fff 100%)',
  pointerEvents: 'none',
});
const PriceOverlayLabel = styled.p({
  margin: 0,
  fontFamily: 'Pretendard',
  fontSize: 24,
  fontWeight: 400,
  color: '#101010',
});
const PriceOverlayValue = styled.p({
  margin: 0,
  fontFamily: 'Pretendard',
  fontSize: 48,
  fontWeight: 600,
  letterSpacing: -0.49,
  color: '#101010',
});

const GalleryViewport = styled.div({
  overflow: 'hidden',
  margin: '60px 0',
  padding: '0 calc((100% - 315px) / 2)',
  '& img': { width: 315, height: 190, borderRadius: 8, objectFit: 'cover', flexShrink: 0 },
  [mobile]: {
    margin: '32px 0',
    padding: '0 16px',
    '& img': { width: 122, height: 74, borderRadius: 3 },
  },
});

const Rail = styled.div<{ activeIndex: number; variant: AdCarouselProps['variant'] }>(({ activeIndex, variant }) => {
  const gap = variant === 'hero' ? 60 : 32;
  const width = variant === 'hero' ? 1059 : 315;

  return {
    display: 'flex',
    gap,
    transform: variant === 'hero'
      ? `translateX(calc(50vw - ${width / 2}px - ${activeIndex * (width + gap)}px))`
      : `translateX(${-activeIndex * (width + gap)}px)`,
    transition: 'transform 0.5s ease-in-out',
    [mobile]: variant === 'gallery'
      ? { gap: 12, transform: `translateX(${-activeIndex * 134}px)` }
      : undefined,
  };
});

const SlideButton = styled.button({
  display: 'block',
  flex: '0 0 auto',
  padding: 0,
  border: 0,
  borderRadius: 'inherit',
  background: 'transparent',
  cursor: 'pointer',
  '&:focus-visible': { outline: `3px solid ${c.primary}`, outlineOffset: 3 },
});

/** 홈의 상단·중간 광고에 공통으로 쓰는 자동 순환 광고 캐러셀입니다. */
export function AdCarousel({ ariaLabel, items, variant, interval = 5000, priceOverlay }: AdCarouselProps) {
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

  const handleTransitionEnd = () => {
    if (railIndex !== itemCount + 1) return;
    setShouldAnimate(false);
    setRailIndex(1);
    // 복제한 첫 광고로 이동한 뒤, 애니메이션 없이 실제 첫 광고로 되돌립니다.
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
        <Rail activeIndex={railIndex} variant={variant} style={{ transition: shouldAnimate ? undefined : 'none' }} onTransitionEnd={handleTransitionEnd}>
          {slides.map((item, index) => (
            <SlideButton key={`${item.src}-${index}`} type="button" onClick={() => goTo((index - 1 + itemCount) % itemCount)}>
              <Image src={item.src} alt={index === railIndex ? item.alt : ''} width={variant === 'hero' ? 1059 : 315} height={variant === 'hero' ? 252 : 190} />
            </SlideButton>
          ))}
        </Rail>
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
