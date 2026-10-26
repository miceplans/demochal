import type { AdCarouselItem } from './AdCarousel';

/**
 * 홈에 게재 중인 광고가 없거나 조회에 실패하면 보여주는 기본 광고 세트입니다.
 * 홈(HomePage)과 BIZ 콘솔의 광고 추가 미리보기(AdPlacementPreview)가 항상 같은
 * 목록을 보여주도록 여기서 단일 소스로 관리합니다.
 */
export const fallbackAds: Record<'hero' | 'gallery', AdCarouselItem[]> = {
  hero: [
    {
      src: '/assets/Hero-animation.webm',
      alt: 'SEMO 브랜드 로고 애니메이션 광고',
      type: 'video' as const,
    },
    { src: '/assets/figma-ads/home-hero-2.png', alt: '간편하고 쉬운 공모전을 위해, SEMO 광고' },
    { src: '/assets/figma-ads/home-hero-3.png', alt: '공모전 시작부터 끝까지 SEMO.BIZ 광고' },
    { src: '/assets/figma-ads/home-hero-1.png', alt: 'SEMO 브랜드 로고 광고' },
  ],
  // 중간(하단) 광고는 6개다. 상단과 겹치지 않는 소재를 먼저 쓰고, repo에 남은 소재가
  // 모자라 마지막 2개만 상단 소재(home-hero-2/3)를 함께 쓴다.
  // TODO: 중간 광고 전용 소재가 준비되면 마지막 2개를 교체한다.
  gallery: [
    { src: '/assets/figma-ads/home-gallery.png', alt: 'Gyeonggi-Do Social Impact Creators 광고' },
    { src: '/assets/figma-ads/home-hero.png', alt: 'PIZZ FLEX 브랜드 광고' },
    { src: '/assets/ads/hero-fallback.png', alt: 'SEMO 로고 광고' },
    { src: '/assets/ads/gallery-fallback.png', alt: '간편하고 쉬운 공모전을 위해, SEMO 광고' },
    { src: '/assets/figma-ads/home-hero-2.png', alt: '간편하고 쉬운 공모전을 위해, SEMO 광고' },
    { src: '/assets/figma-ads/home-hero-3.png', alt: '공모전 시작부터 끝까지 SEMO.BIZ 광고' },
  ],
};

/**
 * 게재 중인 광고가 기본 세트보다 적으면 부족한 만큼 기본 광고로 채운다. 한 장만
 * 게재돼도 캐러셀 양옆에 같은 광고가 복제돼 전부 똑같이 보이는 일을 막는다.
 * 게재 광고가 없으면 기본 세트를 그대로 쓴다.
 */
export function fillWithFallback(
  liveAds: AdCarouselItem[] | undefined,
  fallback: AdCarouselItem[],
): AdCarouselItem[] {
  if (!liveAds || liveAds.length === 0) return fallback;
  const missing = fallback.length - liveAds.length;
  if (missing <= 0) return liveAds;
  const liveSrcs = new Set(liveAds.map((ad) => ad.src));
  const fillers = fallback.filter((ad) => !liveSrcs.has(ad.src)).slice(0, missing);
  return [...liveAds, ...fillers];
}

/**
 * 광고 추가 미리보기에 보여줄 슬롯 목록을 만든다. 실제 홈 노출 목록(없으면
 * fallback)과 같은 개수를 유지하고, 업로드한 이미지는 첫 슬롯 하나만 교체한다.
 * 한 장을 올려도 나머지 슬롯이 기존 광고(부족하면 기본 광고)로 보여야 미리보기가 홈과 같다.
 */
export function buildPreviewAds(
  liveAds: AdCarouselItem[] | undefined,
  fallback: AdCarouselItem[],
  uploaded: AdCarouselItem | undefined,
): AdCarouselItem[] {
  const base = fillWithFallback(liveAds, fallback);
  if (!uploaded) return base;
  return [uploaded, ...base.slice(1)];
}
