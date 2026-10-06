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
  ],
  gallery: [
    { src: '/assets/figma-ads/home-hero-1.png', alt: 'SEMO 브랜드 로고 광고' },
    { src: '/assets/figma-ads/home-hero-2.png', alt: '간편하고 쉬운 공모전을 위해, SEMO 광고' },
    { src: '/assets/figma-ads/home-hero-3.png', alt: '공모전 시작부터 끝까지 SEMO.BIZ 광고' },
  ],
};

/**
 * 광고 추가 미리보기에 보여줄 슬롯 목록을 만든다. 실제 홈 노출 목록(없으면
 * fallback)과 같은 개수를 유지하고, 업로드한 이미지는 첫 슬롯 하나만 교체한다.
 * 한 장을 올려도 나머지 슬롯이 기존 광고 그대로 보여야 미리보기가 홈과 같다.
 */
export function buildPreviewAds(
  liveAds: AdCarouselItem[] | undefined,
  fallback: AdCarouselItem[],
  uploaded: AdCarouselItem | undefined,
): AdCarouselItem[] {
  const base = liveAds && liveAds.length > 0 ? liveAds : fallback;
  if (!uploaded) return base;
  return [uploaded, ...base.slice(1)];
}
