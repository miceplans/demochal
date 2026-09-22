'use client';

import { useCallback, useEffect, useRef, useState, type TransitionEvent } from 'react';
import Image from 'next/image';
import styled from '@emotion/styled';
import { colors as c, mobile, shadows } from '@/styles/design';

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

const SLIDE_WIDTH = { hero: 1059, gallery: 315 } as const;
const SLIDE_GAP = { hero: 60, gallery: 32 } as const;
const MOBILE_GALLERY_STEP = 122 + 12;
const mobileLayoutQuery = '(max-width: 480px)';

const Rail = styled.div<{ activeIndex: number; variant: AdCarouselProps['variant'] }>(
  ({ activeIndex, variant }) => {
    const gap = SLIDE_GAP[variant];
    const width = SLIDE_WIDTH[variant];

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
          ? { gap: '12px', transform: `translateX(${-activeIndex * MOBILE_GALLERY_STEP}px)` }
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
  width: '56px',
  height: '56px',
  padding: 0,
  border: 0,
  borderRadius: '50%',
  background: 'transparent',
  cursor: 'pointer',
  transform: 'translateY(-50%)',
  [direction === 'prev' ? 'left' : 'right']: navOffset[variant],
  '& svg': {
    opacity: 0.7,
    filter: `drop-shadow(${shadows.carouselNav})`,
    transition: 'transform 0.15s ease, opacity 0.15s ease',
  },
  '&:hover svg': { transform: 'scale(1.15)', opacity: 1 },
  '&:focus-visible': { outline: `3px solid ${c.primary}`, outlineOffset: '3px' },
  ...(variant === 'gallery' && {
    [mobile]: {
      width: '40px',
      height: '40px',
      // GalleryViewport는 overflow: hidden이라 클리핑 경계가 뷰포트의 바깥 테두리와 일치합니다.
      // focus-visible 아웃라인(3px) + outline-offset(3px)만큼 안쪽으로 떨어뜨려야
      // 키보드 포커스 링과 그림자가 잘리지 않습니다.
      ...(direction === 'prev' ? { left: '6px' } : { right: '6px' }),
    },
  }),
}));

function ArrowIcon({ direction }: { direction: 'prev' | 'next' }) {
  return (
    <svg width="34" height="34" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d={direction === 'prev' ? 'M9 3.5 5.5 7 9 10.5' : 'M5 3.5 8.5 7 5 10.5'}
        stroke={c.white}
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * 홈의 상단·중간 광고에 공통으로 쓰는 자동 순환 광고 캐러셀입니다.
 * 실제 목록 앞뒤에 복제 슬라이드를 붙여 5 1 2 3 4 5 1 2 3 4 5… 처럼 순환시키는데,
 * 복제 장수(pad)는 뷰포트에 동시에 보이는 슬라이드 수에 맞춰 늘어나므로 화면 비율이
 * 작아 슬라이드가 여러 장 겹쳐 보일 때도 레일이 끊기지 않습니다.
 */
export function AdCarousel({
  ariaLabel,
  items,
  variant,
  interval = 5000,
  priceOverlay,
}: AdCarouselProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const padRef = useRef(1);
  const [pad, setPad] = useState(1);
  const [railIndex, setRailIndex] = useState(1);
  const [shouldAnimate, setShouldAnimate] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const itemCount = items.length;

  const getStep = useCallback(() => {
    if (variant === 'hero') return SLIDE_WIDTH.hero + SLIDE_GAP.hero;
    return window.matchMedia(mobileLayoutQuery).matches
      ? MOBILE_GALLERY_STEP
      : SLIDE_WIDTH.gallery + SLIDE_GAP.gallery;
  }, [variant]);

  // 뷰포트 폭이 넓어 슬라이드가 여러 장 동시에 보일 때 복제본이 1장뿐이면 경계
  // 부근에서 이어질 슬라이드가 없어 레일이 끊겨 보입니다. 동시에 보이는 슬라이드
  // 수만큼 앞뒤 복제본(pad)을 늘려 어떤 비율에서도 항상 채워지도록 합니다.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || itemCount < 2) return;
    const measure = () => {
      const step = getStep();
      const visibleCount = Math.min(itemCount, Math.ceil(viewport.clientWidth / step) + 1);
      const nextPad = Math.max(1, visibleCount + 1);
      const prevPad = padRef.current;
      if (prevPad === nextPad) return;
      padRef.current = nextPad;
      // pad가 바뀌면 slides 배열에서 실제 광고가 시작하는 위치도 함께 밀리므로,
      // 같은 광고가 계속 보이도록 railIndex를 그 차이만큼 보정합니다. setState 업데이터
      // 안에서 다른 state를 갱신하면 StrictMode의 순수성 재호출로 어긋날 수 있어
      // prevPad는 ref로 추적하고, 각 state는 독립적으로 갱신합니다.
      const diff = nextPad - prevPad;
      setShouldAnimate(false);
      setPad(nextPad);
      setRailIndex((prevIndex) => prevIndex + diff);
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setShouldAnimate(true));
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [getStep, itemCount]);

  useEffect(() => {
    if (isPaused || itemCount < 2) return;
    const timer = window.setInterval(() => {
      // transitionend가 발생하지 않는 상황(모바일 hero 숨김, 비활성 탭 등)에서도
      // railIndex가 복제 슬라이드 경계(pad + itemCount)를 넘어 무한정 드리프트하지 않도록
      // 수동 내비게이션과 동일한 상한을 적용합니다.
      setRailIndex((index) => Math.min(index + 1, pad + itemCount));
    }, interval);
    return () => window.clearInterval(timer);
  }, [interval, isPaused, itemCount, pad]);

  if (itemCount === 0) return null;

  // 실제 목록(items) 앞뒤에 pad장씩 복제본을 덧붙입니다. pad가 1보다 크면
  // "5 1 2 3 4 5 1 2 3 4 5"처럼 여러 세트가 이어져, 슬라이드가 여러 장 보이는
  // 뷰포트에서도 항상 실제 이미지로 채워집니다.
  const slides = Array.from(
    { length: itemCount + pad * 2 },
    (_, i) => items[(((i - pad) % itemCount) + itemCount) % itemCount],
  );
  const Viewport = variant === 'hero' ? HeroViewport : GalleryViewport;
  const goTo = (index: number) => {
    setShouldAnimate(true);
    setRailIndex(pad + index);
  };
  // 전환이 끝나기 전 연속 클릭으로 복제 슬라이드 범위(pad - 1 ~ pad + itemCount)를
  // 벗어나 그릴 슬라이드가 없어지지 않도록 이동 가능한 rail 위치를 경계로 가둡니다.
  const goToRail = (rail: number) => {
    if (rail < pad - 1 || rail > pad + itemCount) return;
    setShouldAnimate(true);
    setRailIndex(rail);
  };
  const goToPrev = () => goToRail(railIndex - 1);
  const goToNext = () => goToRail(railIndex + 1);

  const handleTransitionEnd = (event: TransitionEvent<HTMLDivElement>) => {
    // 내부 요소(버튼 등)의 transitionend가 버블링되어 레일 위치를 건드리지 않도록 막습니다.
    if (event.target !== event.currentTarget || event.propertyName !== 'transform') return;
    if (railIndex !== pad - 1 && railIndex !== pad + itemCount) return;
    setShouldAnimate(false);
    setRailIndex(railIndex === pad - 1 ? railIndex + itemCount : railIndex - itemCount);
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
      <Viewport ref={viewportRef}>
        <Rail
          activeIndex={railIndex}
          variant={variant}
          style={{ transition: shouldAnimate ? undefined : 'none' }}
          onTransitionEnd={handleTransitionEnd}
        >
          {slides.map((item, index) => {
            const itemIndex = (((index - pad) % itemCount) + itemCount) % itemCount;
            return (
              <SlideButton
                key={`${item.src}-${index}`}
                type="button"
                onClick={() => goTo(itemIndex)}
              >
                <Image
                  src={item.src}
                  alt={index === railIndex ? item.alt : ''}
                  width={SLIDE_WIDTH[variant]}
                  height={variant === 'hero' ? 252 : 190}
                />
              </SlideButton>
            );
          })}
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
