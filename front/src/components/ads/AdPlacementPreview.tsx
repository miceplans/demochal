'use client';

import { useEffect, useMemo, useRef, useState, type SyntheticEvent } from 'react';
import { createPortal } from 'react-dom';
import styled from '@emotion/styled';
import { generated } from '@semochal/api-client';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { MovingAds } from './MovingAds';
import { AdImageUploader } from './AdImageUploader';
import { buildPreviewAds, fallbackAds } from './fallback-ads';

export type AdPreviewView = 'mobile' | 'pc';
export type AdPlacement = 'hero' | 'gallery';

type Props = {
  view: AdPreviewView;
  price?: number;
  /** 서버 광고 상품(`GET /ads/products`)의 1일 가격. 없으면 fallbackPrice를 쓴다. */
  dailyPrices?: Partial<Record<AdPlacement, number>>;
  onSelect?: (placement: AdPlacement) => void;
  selectImmediately?: boolean;
  uploadPlacement?: AdPlacement | null;
  uploadedImages?: Partial<Record<AdPlacement, string>>;
  onImagePicked?: (placement: AdPlacement, file: File) => void;
  processing?: boolean;
};

const artwork = {
  pc: { width: 1200, background: '/assets/pc-screen.png' },
  mobile: { width: 358, background: '/assets/mobile-screen.png' },
} as const;

// 게재 중인 광고가 없거나 조회에 실패하면 fallbackAds(홈과 공유) 기본 광고 세트를
// 보여준다. 홈(HomePage)과 같은 silentError 관례를 쓴다.
const publicAdsQuery = { query: { meta: { silentError: true } } };

type PreviewAd = {
  src: string;
  alt: string;
  type?: 'image' | 'video';
};

function toPreviewAds(
  response: Awaited<ReturnType<typeof generated.listPublicAds>> | undefined,
): PreviewAd[] | undefined {
  if (response?.status !== 200 || response.data.length === 0) return undefined;
  return response.data.map((ad) => ({ src: ad.imageUrl, alt: ad.title }));
}

// fallbackPrice는 서버 기본 상품(server/src/modules/ads/ads.service.ts DEFAULT_PRODUCTS)의
// dailyPrice와 맞춘다. 상품 조회 전이나 실패 시에만 쓰인다.
const adInfo = {
  hero: { name: '홈 상단 배너 광고', fallbackPrice: 100000 },
  gallery: { name: '홈 중간 이미지 광고', fallbackPrice: 50000 },
} as const;

/** Shared Figma-faithful advertising preview for business and admin screens. */
export function AdPlacementPreview({
  view,
  price,
  dailyPrices,
  onSelect,
  selectImmediately = false,
  uploadPlacement = null,
  uploadedImages = {},
  onImagePicked,
  processing = false,
}: Props) {
  const [active, setActive] = useState<AdPlacement | null>(null);
  const [tooltip, setTooltip] = useState<{
    placement: AdPlacement;
    top: number;
    left: number;
  } | null>(null);
  const canvasRef = useRef<HTMLElement>(null);
  const tooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
    },
    [],
  );

  const screen = artwork[view];
  const Slot = view === 'mobile' ? MobileHeroSlot : HeroSlot;
  const priceOf = (placement: AdPlacement) =>
    price ?? dailyPrices?.[placement] ?? adInfo[placement].fallbackPrice;
  const isPricingPreview = !onSelect;
  // 실제 홈 노출 목록과 같은 광고 수·소재로 미리보기를 구성한다. 업로드한 이미지는
  // 첫 슬롯 하나만 교체해 한 장을 올려도 나머지 슬롯이 기존 광고 그대로 보인다.
  const { data: heroAdList } = generated.useListPublicAds({ placement: 'hero' }, publicAdsQuery);
  const { data: galleryAdList } = generated.useListPublicAds(
    { placement: 'gallery' },
    publicAdsQuery,
  );
  const heroItems = useMemo(
    () =>
      buildPreviewAds(
        toPreviewAds(heroAdList),
        fallbackAds.hero,
        uploadedImages.hero
          ? { src: uploadedImages.hero, alt: '업로드한 홈 상단 광고 이미지' }
          : undefined,
      ),
    [heroAdList, uploadedImages.hero],
  );
  const galleryItems = useMemo(
    () =>
      buildPreviewAds(
        toPreviewAds(galleryAdList),
        fallbackAds.gallery,
        uploadedImages.gallery
          ? { src: uploadedImages.gallery, alt: '업로드한 홈 중간 광고 이미지' }
          : undefined,
      ),
    [galleryAdList, uploadedImages.gallery],
  );
  const showTooltip = (placement: AdPlacement) => (event: SyntheticEvent<HTMLButtonElement>) => {
    const canvas = canvasRef.current?.getBoundingClientRect();
    const target = event.currentTarget.getBoundingClientRect();
    if (!canvas) return;
    setTooltip({
      placement,
      top: target.bottom - canvas.top + 12,
      left: target.left - canvas.left + target.width / 2,
    });
    if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
    tooltipTimer.current = setTimeout(() => {
      setTooltip((current) => (current?.placement === placement ? null : current));
      tooltipTimer.current = null;
    }, 1400);
  };
  const handleSlotEnter =
    (placement: AdPlacement) => (event: SyntheticEvent<HTMLButtonElement>) => {
      showTooltip(placement)(event);
      if (isPricingPreview) setActive(placement);
    };
  const handleSlotClick = (placement: AdPlacement) => {
    setActive(placement);
    if (selectImmediately && onSelect) onSelect(placement);
  };

  return (
    <Canvas
      ref={canvasRef}
      view={view}
      aria-label={`${view === 'mobile' ? '모바일' : 'PC'} 사용자 홈 광고 미리보기`}
    >
      {/* 슬라이드 수가 바뀌면(예: fallback 3개에서 노출 1개로 줄면) 레일 위치를 재시작해
          복제본 범위 밖의 위치가 남지 않게 한다. 홈 AdCarousel의 key 관례와 같다. */}
      <MovingAds
        key={`hero-${heroItems.length}`}
        ariaLabel="홈 상단 광고"
        itemCount={heroItems.length}
        interval={5000}
        paused={uploadPlacement === 'hero'}
      >
        {({
          activeIndex,
          goPrev,
          goNext,
          loopIndexes,
          railIndex,
          shouldAnimate,
          handleTransitionEnd,
        }) => (
          <HeroViewport>
            <HeroRail
              active={railIndex}
              view={view}
              style={{ transition: shouldAnimate ? undefined : 'none' }}
              onTransitionEnd={handleTransitionEnd}
            >
              {loopIndexes.map((item, position) => {
                if (uploadPlacement === 'hero') {
                  return (
                    <HeroSlotFrame key={`${item}-${position}`} view={view}>
                      <AdImageUploader
                        compact={view === 'mobile'}
                        busy={processing}
                        onFileSelected={(file) => onImagePicked?.('hero', file)}
                      />
                    </HeroSlotFrame>
                  );
                }
                const ad = heroItems[item];
                // 무한 순환용 복제 슬롯(첫·마지막)은 장식이라 보조기술에서 숨긴다.
                // 슬롯이 1개뿐이면 복제본이 없으므로 유일 슬롯을 숨기지 않는다.
                const isClone =
                  heroItems.length > 1 && (position === 0 || position === heroItems.length + 1);
                return (
                  <Slot
                    key={`${item}-${position}`}
                    type="button"
                    active={active === 'hero'}
                    onMouseEnter={handleSlotEnter('hero')}
                    onFocus={showTooltip('hero')}
                    onBlur={() => setTooltip(null)}
                    onClick={() => handleSlotClick('hero')}
                    aria-label="홈 상단 광고 선택"
                  >
                    {ad.type === 'video' ? (
                      <video
                        src={ad.src}
                        autoPlay
                        loop
                        muted
                        playsInline
                        aria-label={isClone ? undefined : ad.alt}
                        aria-hidden={isClone || undefined}
                      />
                    ) : (
                      <img src={ad.src} alt={isClone ? '' : ad.alt} />
                    )}
                  </Slot>
                );
              })}
            </HeroRail>
            <HeroPager>
              <PagerArrow type="button" onClick={goPrev} aria-label="상단 광고 이전">
                <ArrowIcon direction="prev" />
              </PagerArrow>
              <HeroDots aria-label={`상단 광고 ${activeIndex + 1} / 5`} aria-live="polite">
                {Array.from({ length: 5 }, (_, index) => (
                  <HeroDot key={index} active={activeIndex === index} />
                ))}
              </HeroDots>
              <PagerArrow type="button" onClick={goNext} aria-label="상단 광고 다음">
                <ArrowIcon direction="next" />
              </PagerArrow>
            </HeroPager>
          </HeroViewport>
        )}
      </MovingAds>
      <Background src={screen.background} alt="" aria-hidden="true" />
      <MovingAds
        key={`gallery-${galleryItems.length}`}
        ariaLabel="홈 중간 이미지 광고"
        itemCount={galleryItems.length}
        interval={5000}
        paused={uploadPlacement === 'gallery'}
      >
        {({
          activeIndex,
          goPrev,
          goNext,
          loopIndexes,
          railIndex,
          shouldAnimate,
          handleTransitionEnd,
        }) => (
          <GalleryViewport>
            <GalleryRail
              active={railIndex}
              view={view}
              style={{ transition: shouldAnimate ? undefined : 'none' }}
              onTransitionEnd={handleTransitionEnd}
            >
              {loopIndexes.map((item, position) => {
                if (uploadPlacement === 'gallery') {
                  return (
                    <GallerySlotFrame key={`${item}-${position}`} view={view}>
                      <AdImageUploader
                        compact
                        busy={processing}
                        onFileSelected={(file) => onImagePicked?.('gallery', file)}
                      />
                    </GallerySlotFrame>
                  );
                }
                const ad = galleryItems[item];
                // 무한 순환용 복제 슬롯(첫·마지막)은 장식이라 보조기술에서 숨긴다.
                // 슬롯이 1개뿐이면 복제본이 없으므로 유일 슬롯을 숨기지 않는다.
                const isClone =
                  galleryItems.length > 1 &&
                  (position === 0 || position === galleryItems.length + 1);
                return (
                  <GallerySlot
                    key={`${item}-${position}`}
                    view={view}
                    type="button"
                    active={active === 'gallery'}
                    onMouseEnter={handleSlotEnter('gallery')}
                    onFocus={showTooltip('gallery')}
                    onBlur={() => setTooltip(null)}
                    onClick={() => handleSlotClick('gallery')}
                    aria-label="홈 중간 이미지 광고 선택"
                  >
                    {ad.type === 'video' ? (
                      <video
                        src={ad.src}
                        autoPlay
                        loop
                        muted
                        playsInline
                        aria-label={isClone ? undefined : ad.alt}
                        aria-hidden={isClone || undefined}
                      />
                    ) : (
                      <img src={ad.src} alt={isClone ? '' : ad.alt} />
                    )}
                  </GallerySlot>
                );
              })}
            </GalleryRail>
            <HeroPager>
              <PagerArrow type="button" onClick={goPrev} aria-label="중간 광고 이전">
                <ArrowIcon direction="prev" />
              </PagerArrow>
              <HeroDots aria-label={`중간 광고 ${activeIndex + 1} / 5`} aria-live="polite">
                {Array.from({ length: 5 }, (_, index) => (
                  <HeroDot key={index} active={activeIndex === index} />
                ))}
              </HeroDots>
              <PagerArrow type="button" onClick={goNext} aria-label="중간 광고 다음">
                <ArrowIcon direction="next" />
              </PagerArrow>
            </HeroPager>
          </GalleryViewport>
        )}
      </MovingAds>
      {tooltip && (
        <TooltipCard role="tooltip" top={tooltip.top} left={tooltip.left}>
          <strong style={textStyle.bodyStrong}>{adInfo[tooltip.placement].name}</strong>
          <p style={{ margin: '4px 0', color: c.gray500, ...textStyle.metaText }}>1일 광고비</p>
          <strong style={{ fontSize: 22 }}>{priceOf(tooltip.placement).toLocaleString()}원</strong>
          {onSelect && !selectImmediately && (
            <PriceAction
              type="button"
              onClick={() => {
                setTooltip(null);
                onSelect(tooltip.placement);
              }}
            >
              {uploadedImages[tooltip.placement] ? '결제하러 가기 →' : '광고 이미지 업로드 →'}
            </PriceAction>
          )}
        </TooltipCard>
      )}
      {active &&
        isPricingPreview &&
        createPortal(
          <PaymentOverlay role="presentation" onClick={() => setActive(null)}>
            <PaymentDialog
              role="dialog"
              aria-modal="true"
              aria-labelledby="ad-payment-title"
              onClick={(event) => event.stopPropagation()}
            >
              <h2 id="ad-payment-title" style={{ margin: 0, ...textStyle.h2_2 }}>
                단기 결제
              </h2>
              <p style={{ margin: '10px 0 4px', color: c.gray500, ...textStyle.caption }}>
                1일 광고비
              </p>
              <strong style={{ fontSize: 18 }}>{priceOf(active).toLocaleString()}원</strong>
              <PaymentActions>
                <PaymentButton type="button" onClick={() => setActive(null)}>
                  취소
                </PaymentButton>
                <PaymentButton type="button" primary onClick={() => setActive(null)}>
                  결제하기
                </PaymentButton>
              </PaymentActions>
            </PaymentDialog>
          </PaymentOverlay>,
          document.body,
        )}
    </Canvas>
  );
}

const Canvas = styled('section', { shouldForwardProp: (prop) => prop !== 'view' })<{
  view: AdPreviewView;
}>(({ view }) => ({
  position: 'relative',
  width: `min(100%, ${artwork[view].width}px)`,
  color: c.gray900,
}));

const HeroSlot = styled('button', { shouldForwardProp: (prop) => prop !== 'active' })<{
  active: boolean;
}>(({ active }) => ({
  position: 'relative',
  display: 'block',
  width: '100%',
  height: 'clamp(150px, 21vw, 252px)',
  padding: 8,
  overflow: 'hidden',
  border: `4px dashed ${active ? c.primary : '#7db2ff'}`,
  borderRadius: 20,
  background: c.white,
  cursor: 'pointer',
  transition: 'transform 180ms ease',
  transformOrigin: 'center',
  '& img, & video': {
    display: 'block',
    width: '100%',
    height: '100%',
    borderRadius: 12,
    objectFit: 'cover',
  },
  '&:hover': { transform: 'scale(1.02)', zIndex: 2 },
  '&:focus-visible': { outline: `2px solid ${c.primary}`, outlineOffset: 4 },
}));
const MobileHeroSlot = styled(HeroSlot)({ height: 150 });
const HeroSlotFrame = styled('div', { shouldForwardProp: (prop) => prop !== 'view' })<{
  view: AdPreviewView;
}>(({ view }) => ({
  position: 'relative',
  display: 'block',
  width: '100%',
  height: view === 'mobile' ? 150 : 'clamp(150px, 21vw, 252px)',
  padding: 8,
  overflow: 'hidden',
  border: `4px dashed ${c.primary}`,
  borderRadius: 20,
  background: c.white,
}));
const HeroViewport = styled.div({ overflow: 'hidden', padding: '8px 0', margin: '-8px 0' });
const HeroRail = styled('div', {
  shouldForwardProp: (prop) => prop !== 'active' && prop !== 'view',
})<{ active: number; view: AdPreviewView }>(({ active, view }) => ({
  display: 'flex',
  width: '100%',
  gap: view === 'pc' ? 24 : 0,
  transform:
    view === 'pc'
      ? `translateX(calc(${-active * 100}% + ${active * 136 + 80}px))`
      : `translateX(${-active * 100}%)`,
  transition: 'transform 420ms ease',
  '& > *': { flex: view === 'pc' ? '0 0 calc(100% - 160px)' : '0 0 100%' },
}));
const HeroPager = styled.div({
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  gap: 10,
  marginTop: 10,
});
const HeroDots = styled.div({ display: 'flex', alignItems: 'center', gap: 6 });
const PagerArrow = styled.button({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 24,
  height: 24,
  padding: 0,
  border: `1px solid ${c.gray200}`,
  borderRadius: 99,
  background: c.white,
  color: c.gray500,
  cursor: 'pointer',
  '&:hover': { borderColor: c.primary, color: c.primary },
  '&:focus-visible': { outline: `2px solid ${c.primary}`, outlineOffset: 2 },
});
function ArrowIcon({ direction }: { direction: 'prev' | 'next' }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path
        d={direction === 'prev' ? 'M7.5 2.5 4 6l3.5 3.5' : 'M4.5 2.5 8 6 4.5 9.5'}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
const HeroDot = styled('span', { shouldForwardProp: (prop) => prop !== 'active' })<{
  active: boolean;
}>(({ active }) => ({
  width: active ? 18 : 6,
  height: 6,
  borderRadius: 99,
  background: active ? c.primary : c.gray200,
  transition: 'width 180ms ease, background 180ms ease',
}));
const Background = styled.img({
  display: 'block',
  width: '100%',
  height: 'auto',
  pointerEvents: 'none',
  userSelect: 'none',
});
const GalleryViewport = styled.div({
  width: '100%',
  marginTop: 24,
  padding: '8px 0',
  overflow: 'hidden',
});
const GalleryRail = styled('div', {
  shouldForwardProp: (prop) => prop !== 'active' && prop !== 'view',
})<{ active: number; view: AdPreviewView }>(({ active, view }) => ({
  display: 'flex',
  gap: view === 'mobile' ? 12 : 32,
  transform: `translateX(${-active * (view === 'mobile' ? 134 : 346)}px)`,
  transition: 'transform 420ms ease',
}));
const GallerySlot = styled('button', {
  shouldForwardProp: (prop) => prop !== 'active' && prop !== 'view',
})<{ active: boolean; view: AdPreviewView }>(({ active, view }) => ({
  position: 'relative',
  display: 'block',
  flex: `0 0 ${view === 'mobile' ? 122 : 314}px`,
  padding: view === 'mobile' ? 3 : 8,
  overflow: 'hidden',
  border: `4px dashed ${active ? c.primary : '#32a6f9'}`,
  borderRadius: 20,
  background: c.white,
  cursor: 'pointer',
  transition: 'transform 180ms ease',
  transformOrigin: 'center',
  '& img, & video': {
    display: 'block',
    width: '100%',
    aspectRatio: '298 / 190',
    borderRadius: 8,
    objectFit: 'cover',
  },
  '&:hover': { transform: 'scale(1.04)', zIndex: 2 },
  '&:focus-visible': { outline: `2px solid ${c.primary}`, outlineOffset: 4 },
}));
const GallerySlotFrame = styled('div', { shouldForwardProp: (prop) => prop !== 'view' })<{
  view: AdPreviewView;
}>(({ view }) => ({
  position: 'relative',
  display: 'block',
  flex: `0 0 ${view === 'mobile' ? 122 : 314}px`,
  padding: view === 'mobile' ? 3 : 8,
  overflow: 'hidden',
  border: `4px dashed ${c.primary}`,
  borderRadius: 20,
  background: c.white,
}));
const TooltipCard = styled('div', {
  shouldForwardProp: (prop) => prop !== 'top' && prop !== 'left',
})<{ top: number; left: number }>(({ top, left }) => ({
  position: 'absolute',
  zIndex: 20,
  top,
  left,
  width: 250,
  maxWidth: 'calc(100% - 24px)',
  transform: 'translateX(-50%)',
  padding: '14px 16px',
  border: `0.5px solid ${c.gray200}`,
  borderRadius: 10,
  background: c.white,
  boxShadow: '0 10px 26px rgba(27, 33, 44, .16)',
}));
const PriceAction = styled.button({
  display: 'block',
  marginTop: 8,
  padding: 0,
  border: 0,
  background: 'transparent',
  color: c.primary,
  cursor: 'pointer',
  ...textStyle.label,
});
const PaymentOverlay = styled.div({
  position: 'fixed',
  zIndex: 100,
  inset: 0,
  display: 'grid',
  placeItems: 'center',
  padding: 24,
  background: 'rgba(0, 0, 0, .2)',
});
const PaymentDialog = styled.div({
  width: 'min(100%, 404px)',
  padding: 20,
  borderRadius: 10,
  background: c.white,
  boxShadow: '0 12px 32px rgba(0, 0, 0, .16)',
});
const PaymentActions = styled.div({
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 10,
  marginTop: 12,
});
const PaymentButton = styled('button', { shouldForwardProp: (prop) => prop !== 'primary' })<{
  primary?: boolean;
}>(({ primary }) => ({
  height: 26,
  border: primary ? 0 : `0.5px solid ${c.gray200}`,
  borderRadius: 4,
  background: primary ? c.primary : c.white,
  color: primary ? c.white : c.gray900,
  cursor: 'pointer',
  ...textStyle.caption,
}));
