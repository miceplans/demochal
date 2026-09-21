'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import styled from '@emotion/styled';
import { keyframes } from '@emotion/react';
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

// 무한 흐름에서 한 세트(전체 광고 목록 1바퀴)가 차지하는 폭입니다.
// gap이 슬라이드 뒤에도 균일하게 적용되므로 세트 경계마다 간격이 이어집니다.
const slideSize = {
  hero: { width: 1059, height: 252, gap: 60 },
  gallery: { width: 315, height: 190, gap: 32 },
} as const;
const mobileGallerySlide = { width: 122, height: 74, gap: 12 } as const;

const marquee = keyframes`
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(var(--marquee-distance));
  }
`;

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
  '& img': {
    width: '315px',
    height: '190px',
    borderRadius: '8px',
    objectFit: 'cover',
    flexShrink: 0,
  },
  [mobile]: {
    margin: '32px 0',
    '& img': { width: '122px', height: '74px', borderRadius: '3px' },
  },
});

const Rail = styled.div<{
  distance: number;
  mobileDistance: number;
  duration: number;
  paused: boolean;
  variant: AdCarouselProps['variant'];
}>(({ distance, mobileDistance, duration, paused, variant }) => ({
  display: 'flex',
  gap: `${slideSize[variant].gap}px`,
  width: 'max-content',
  animation: `${marquee} ${duration}ms linear infinite`,
  animationPlayState: paused ? 'paused' : 'running',
  '--marquee-distance': `-${distance}px`,
  '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
  [mobile]:
    variant === 'gallery'
      ? {
          gap: `${mobileGallerySlide.gap}px`,
          '--marquee-distance': `-${mobileDistance}px`,
        }
      : undefined,
}));

const Slide = styled.div({
  display: 'block',
  flex: '0 0 auto',
  padding: 0,
  borderRadius: 'inherit',
  background: 'transparent',
});

const PauseButton = styled.button({
  position: 'absolute',
  top: '12px',
  right: '12px',
  zIndex: 1,
  display: 'grid',
  placeItems: 'center',
  width: '56px',
  height: '56px',
  padding: 0,
  border: 0,
  borderRadius: '50%',
  background: 'transparent',
  color: c.gray300,
  cursor: 'pointer',
  '& svg': { filter: 'drop-shadow(0 1px 3px rgba(0, 0, 0, 0.45))' },
  '&:hover': { color: '#fff' },
  '&:focus-visible': { outline: `3px solid ${c.primary}`, outlineOffset: '3px' },
  [mobile]: { width: '44px', height: '44px' },
});

function PauseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M5.5 3.5v9M10.5 3.5v9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M5.5 3.5v9l7-4.5-7-4.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 홈의 상단·중간 광고에 공통으로 쓰는 무한 흐름 광고 리스트입니다. */
export function AdCarousel({
  ariaLabel,
  items,
  variant,
  interval = 5000,
  priceOverlay,
}: AdCarouselProps) {
  const itemCount = items.length;
  const { width, gap } = slideSize[variant];
  const setDistance = itemCount * (width + gap);
  const mobileSetDistance = itemCount * (mobileGallerySlide.width + mobileGallerySlide.gap);
  // isPaused는 일시정지 버튼의 사용자 선택을 유지하고, isHoverPaused는
  // 마우스/키보드가 머무는 동안만 잠시 멈춥니다. resumeOverride는 재개를 눌렀을 때
  // 남은 hover/focus 일시정지를 무시해 흐름이 실제로 다시 시작되게 합니다.
  const [isPaused, setIsPaused] = useState(false);
  const [isHoverPaused, setIsHoverPaused] = useState(false);
  const [resumeOverride, setResumeOverride] = useState(false);
  // 서버 렌더와 첫 클라이언트 렌더를 일치시키기 위해 고정 폭을 기본값으로 쓰고,
  // 마운트 뒤 실제 뷰포트 폭에 맞춰 복제 세트 수를 늘립니다.
  const [viewportWidth, setViewportWidth] = useState(1440);
  const [reducedMotion, setReducedMotion] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const syncWidth = () => setViewportWidth(viewport.clientWidth || window.innerWidth);
    syncWidth();
    const observer = new ResizeObserver(syncWidth);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncPreference = () => setReducedMotion(query.matches);
    syncPreference();
    query.addEventListener('change', syncPreference);
    return () => query.removeEventListener('change', syncPreference);
  }, []);

  if (itemCount === 0) return null;

  // 한 세트가 화면을 채우고, 끝까지 이동한 뒤에도 다음 세트가 보일 만큼 남도록
  // 뷰포트 폭에 필요한 최소 복제 횟수를 계산합니다(최소 2세트).
  // 레일 끝의 gap 하나가 빠지므로 뷰포트 폭에 gap을 보정해 더합니다.
  // 갤러리는 모바일에서 더 작은 세트 폭으로 움직이므로 양쪽 요구 중 큰 값을 씁니다.
  const desktopCopies = Math.max(2, Math.floor((viewportWidth + gap) / setDistance) + 2);
  const mobileCopies = Math.max(
    2,
    Math.floor((viewportWidth + mobileGallerySlide.gap) / mobileSetDistance) + 2,
  );
  const copies = variant === 'gallery' ? Math.max(desktopCopies, mobileCopies) : desktopCopies;
  // interval은 광고 한 장당 머무는 시간이라 두고 전체 한 바퀴 시간으로 환산합니다.
  const duration = interval * itemCount;
  const Viewport = variant === 'hero' ? HeroViewport : GalleryViewport;
  const effectivePaused = isPaused || (isHoverPaused && !resumeOverride);
  const togglePause = () => {
    if (effectivePaused) {
      setIsPaused(false);
      setResumeOverride(true);
    } else {
      setIsPaused(true);
      setResumeOverride(false);
    }
  };

  return (
    <section
      aria-label={ariaLabel}
      style={priceOverlay ? { pointerEvents: 'auto' } : undefined}
      onMouseEnter={() => setIsHoverPaused(true)}
      onMouseLeave={() => {
        setIsHoverPaused(false);
        setResumeOverride(false);
      }}
      onFocusCapture={() => setIsHoverPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setIsHoverPaused(false);
          setResumeOverride(false);
        }
      }}
    >
      <Viewport ref={viewportRef}>
        <Rail
          variant={variant}
          distance={setDistance}
          mobileDistance={mobileSetDistance}
          duration={duration}
          paused={effectivePaused}
        >
          {Array.from({ length: copies }, (_, copy) =>
            items.map((item, index) => (
              // 첫 세트만 보조기기에 노출하고, 흐름을 채우는 복제 세트는 숨깁니다.
              <Slide key={`${item.src}-${copy}-${index}`} aria-hidden={copy > 0 || undefined}>
                <Image
                  src={item.src}
                  alt={copy === 0 ? item.alt : ''}
                  width={variant === 'hero' ? 1059 : 315}
                  height={variant === 'hero' ? 252 : 190}
                />
              </Slide>
            )),
          )}
        </Rail>
        {reducedMotion ? null : (
          <PauseButton
            type="button"
            aria-pressed={effectivePaused}
            aria-label={effectivePaused ? '광고 흐름 재개' : '광고 흐름 일시정지'}
            onClick={togglePause}
          >
            {effectivePaused ? <PlayIcon /> : <PauseIcon />}
          </PauseButton>
        )}
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
