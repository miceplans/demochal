'use client';

import { useEffect, useRef, useState, type SyntheticEvent } from 'react';
import { createPortal } from 'react-dom';
import styled from '@emotion/styled';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { MovingAds } from './MovingAds';

export type AdPreviewView = 'mobile' | 'pc';
export type AdPlacement = 'hero' | 'gallery';

type Props = {
  view: AdPreviewView;
  price?: number;
  onSelect?: (placement: AdPlacement) => void;
  selectImmediately?: boolean;
};

const artwork = {
  pc: { width: 1200, background: '/assets/PCscreen.png' },
  mobile: { width: 358, background: '/assets/MobileScreen.png' },
} as const;

const adInfo = {
  hero: { name: '홈 상단 배너 광고', fallbackPrice: 100000 },
  gallery: { name: '홈 중간 이미지 광고', fallbackPrice: 60000 },
} as const;

const Canvas = styled('section', { shouldForwardProp: (prop) => prop !== 'view' })<{ view: AdPreviewView }>(({ view }) => ({
  position: 'relative',
  width: `min(100%, ${artwork[view].width}px)`,
  color: c.gray900,
}));

const HeroSlot = styled('button', { shouldForwardProp: (prop) => prop !== 'active' })<{ active: boolean }>(({ active }) => ({
  position: 'relative', display: 'block', width: '100%', height: 'clamp(150px, 21vw, 252px)', padding: 8, overflow: 'hidden',
  border: `4px dashed ${active ? c.primary : '#7db2ff'}`, borderRadius: 20, background: c.white, cursor: 'pointer',
  transition: 'transform 180ms ease', transformOrigin: 'center',
  '& img': { display: 'block', width: '100%', height: '100%', borderRadius: 12, objectFit: 'cover' },
  '&:hover': { transform: 'scale(1.02)', zIndex: 2 },
  '&:focus-visible': { outline: `2px solid ${c.primary}`, outlineOffset: 4 },
}));
const MobileHeroSlot = styled(HeroSlot)({ height: 150 });
const HeroViewport = styled.div({ overflow: 'hidden', padding: '8px 0', margin: '-8px 0' });
const HeroRail = styled('div', { shouldForwardProp: (prop) => prop !== 'active' && prop !== 'view' })<{ active: number; view: AdPreviewView }>(({ active, view }) => ({
  display: 'flex', width: '100%', gap: view === 'pc' ? 24 : 0,
  transform: view === 'pc'
    ? `translateX(calc(${-active * 100}% + ${active * 136 + 80}px))`
    : `translateX(${-active * 100}%)`,
  transition: 'transform 420ms ease',
  '& > button': { flex: view === 'pc' ? '0 0 calc(100% - 160px)' : '0 0 100%' },
}));
const HeroPager = styled.div({ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 10 });
const HeroDot = styled('span', { shouldForwardProp: (prop) => prop !== 'active' })<{ active: boolean }>(({ active }) => ({
  width: active ? 18 : 6, height: 6, borderRadius: 99, background: active ? c.primary : c.gray200, transition: 'width 180ms ease, background 180ms ease',
}));
const Background = styled.img({ display: 'block', width: '100%', height: 'auto', pointerEvents: 'none', userSelect: 'none' });
const GalleryViewport = styled.div({ width: '100%', marginTop: 24, padding: '8px 0', overflow: 'hidden' });
const GalleryRail = styled('div', { shouldForwardProp: (prop) => prop !== 'active' && prop !== 'view' })<{ active: number; view: AdPreviewView }>(({ active, view }) => ({
  display: 'flex', gap: view === 'mobile' ? 12 : 32,
  transform: `translateX(${-active * (view === 'mobile' ? 134 : 346)}px)`, transition: 'transform 420ms ease',
}));
const GallerySlot = styled('button', { shouldForwardProp: (prop) => prop !== 'active' && prop !== 'view' })<{ active: boolean; view: AdPreviewView }>(({ active, view }) => ({
  position: 'relative', display: 'block', flex: `0 0 ${view === 'mobile' ? 122 : 314}px`, padding: view === 'mobile' ? 3 : 8, overflow: 'hidden',
  border: `4px dashed ${active ? c.primary : '#32a6f9'}`, borderRadius: 20, background: c.white, cursor: 'pointer',
  transition: 'transform 180ms ease', transformOrigin: 'center',
  '& img': { display: 'block', width: '100%', aspectRatio: '298 / 190', borderRadius: 8, objectFit: 'cover' },
  '&:hover': { transform: 'scale(1.04)', zIndex: 2 },
  '&:focus-visible': { outline: `2px solid ${c.primary}`, outlineOffset: 4 },
}));
const TooltipCard = styled('div', { shouldForwardProp: (prop) => prop !== 'top' && prop !== 'left' })<{ top: number; left: number }>(({ top, left }) => ({
  position: 'absolute', zIndex: 20, top, left, width: 250, maxWidth: 'calc(100% - 24px)', transform: 'translateX(-50%)', padding: '14px 16px',
  border: `1px solid ${c.gray200}`, borderRadius: 10, background: c.white, boxShadow: '0 10px 26px rgba(27, 33, 44, .16)',
}));
const PriceAction = styled.button({ display: 'block', marginTop: 8, padding: 0, border: 0, background: 'transparent', color: c.primary, cursor: 'pointer', ...textStyle.label });
const PaymentOverlay = styled.div({
  position: 'fixed', zIndex: 100, inset: 0, display: 'grid', placeItems: 'center', padding: 24,
  background: 'rgba(0, 0, 0, .2)',
});
const PaymentDialog = styled.div({ width: 'min(100%, 404px)', padding: 20, borderRadius: 10, background: c.white, boxShadow: '0 12px 32px rgba(0, 0, 0, .16)' });
const PaymentActions = styled.div({ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 });
const PaymentButton = styled('button', { shouldForwardProp: (prop) => prop !== 'primary' })<{ primary?: boolean }>(({ primary }) => ({
  height: 26, border: primary ? 0 : `1px solid ${c.gray200}`, borderRadius: 4, background: primary ? c.primary : c.white, color: primary ? c.white : c.gray900, cursor: 'pointer', ...textStyle.caption,
}));

/** Shared Figma-faithful advertising preview for business and admin screens. */
export function AdPlacementPreview({ view, price, onSelect, selectImmediately = false }: Props) {
  const [active, setActive] = useState<AdPlacement | null>(null);
  const [tooltip, setTooltip] = useState<{ placement: AdPlacement; top: number; left: number } | null>(null);
  const canvasRef = useRef<HTMLElement>(null);
  const tooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const screen = artwork[view];
  const Slot = view === 'mobile' ? MobileHeroSlot : HeroSlot;
  const priceOf = (placement: AdPlacement) => price ?? adInfo[placement].fallbackPrice;
  const isPricingPreview = !onSelect;
  const showTooltip = (placement: AdPlacement) => (event: SyntheticEvent<HTMLButtonElement>) => {
    const canvas = canvasRef.current?.getBoundingClientRect();
    const target = event.currentTarget.getBoundingClientRect();
    if (!canvas) return;
    setTooltip({ placement, top: target.bottom - canvas.top + 12, left: target.left - canvas.left + target.width / 2 });
    if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
    tooltipTimer.current = setTimeout(() => {
      setTooltip((current) => (current?.placement === placement ? null : current));
      tooltipTimer.current = null;
    }, 1400);
  };
  useEffect(() => () => {
    if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
  }, []);
  const handleSlotEnter = (placement: AdPlacement) => (event: SyntheticEvent<HTMLButtonElement>) => {
    showTooltip(placement)(event);
    if (isPricingPreview) setActive(placement);
  };
  const handleSlotClick = (placement: AdPlacement) => {
    setActive(placement);
    if (selectImmediately && onSelect) onSelect(placement);
  };

  return (
    <Canvas ref={canvasRef} view={view} aria-label={`${view === 'mobile' ? '모바일' : 'PC'} 사용자 홈 광고 미리보기`}>
      <MovingAds ariaLabel="홈 상단 광고" itemCount={5} interval={5000}>
        {({ activeIndex, loopIndexes, railIndex, shouldAnimate, handleTransitionEnd }) => (
          <HeroViewport>
            <HeroRail active={railIndex} view={view} style={{ transition: shouldAnimate ? undefined : 'none' }} onTransitionEnd={handleTransitionEnd}>
              {loopIndexes.map((item, position) => (
                <Slot key={`${item}-${position}`} type="button" active={active === 'hero'} onMouseEnter={handleSlotEnter('hero')} onFocus={showTooltip('hero')} onBlur={() => setTooltip(null)} onClick={() => handleSlotClick('hero')} aria-label="홈 상단 광고 선택">
                  <img src="/assets/figma-ads/home-hero.png" alt={position === 1 ? '홈 상단 광고 예시' : ''} />
                </Slot>
              ))}
            </HeroRail>
            <HeroPager aria-label={`상단 광고 ${activeIndex + 1} / 5`} aria-live="polite">
              {Array.from({ length: 5 }, (_, index) => <HeroDot key={index} active={activeIndex === index} />)}
            </HeroPager>
          </HeroViewport>
        )}
      </MovingAds>
      <Background src={screen.background} alt="" aria-hidden="true" />
      <MovingAds ariaLabel="홈 중간 이미지 광고" itemCount={5} interval={5000}>
        {({ activeIndex, loopIndexes, railIndex, shouldAnimate, handleTransitionEnd }) => (
          <GalleryViewport>
            <GalleryRail active={railIndex} view={view} style={{ transition: shouldAnimate ? undefined : 'none' }} onTransitionEnd={handleTransitionEnd}>
              {loopIndexes.map((item, position) => (
                <GallerySlot key={`${item}-${position}`} view={view} type="button" active={active === 'gallery'} onMouseEnter={handleSlotEnter('gallery')} onFocus={showTooltip('gallery')} onBlur={() => setTooltip(null)} onClick={() => handleSlotClick('gallery')} aria-label="홈 중간 이미지 광고 선택">
                  <img src="/assets/figma-ads/home-gallery.png" alt={position === 1 ? '홈 중간 이미지 광고 예시' : ''} />
                </GallerySlot>
              ))}
            </GalleryRail>
            <HeroPager aria-label={`중간 광고 ${activeIndex + 1} / 5`} aria-live="polite">
              {Array.from({ length: 5 }, (_, index) => <HeroDot key={index} active={activeIndex === index} />)}
            </HeroPager>
          </GalleryViewport>
        )}
      </MovingAds>
      {tooltip && <TooltipCard role="tooltip" top={tooltip.top} left={tooltip.left}><strong style={textStyle.bodyStrong}>{adInfo[tooltip.placement].name}</strong><p style={{ margin: '4px 0', color: c.gray500, ...textStyle.metaText }}>8/25일 ~ 9/24일까지 광고비</p><strong style={{ fontSize: 22 }}>{priceOf(tooltip.placement).toLocaleString()}원</strong>{onSelect && !selectImmediately && <PriceAction type="button" onClick={() => { setTooltip(null); onSelect(tooltip.placement); }}>결제하러 가기 →</PriceAction>}</TooltipCard>}
      {active && isPricingPreview && createPortal(<PaymentOverlay role="presentation" onClick={() => setActive(null)}><PaymentDialog role="dialog" aria-modal="true" aria-labelledby="ad-payment-title" onClick={(event) => event.stopPropagation()}><h2 id="ad-payment-title" style={{ margin: 0, ...textStyle.h2_2 }}>단기 결제</h2><p style={{ margin: '10px 0 4px', color: c.gray500, ...textStyle.caption }}>8/25일 ~ 8/27일까지 광고비</p><strong style={{ fontSize: 18 }}>{priceOf(active).toLocaleString()}원</strong><PaymentActions><PaymentButton type="button" onClick={() => setActive(null)}>취소</PaymentButton><PaymentButton type="button" primary onClick={() => setActive(null)}>결제하기</PaymentButton></PaymentActions></PaymentDialog></PaymentOverlay>, document.body)}
    </Canvas>
  );
}
