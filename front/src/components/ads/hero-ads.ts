import { generated } from '@semochal/api-client';
import type { AdCarouselItem } from './AdCarousel';

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

// 게재 중인 광고가 없거나 조회에 실패하면 위 기본 광고 세트를 보여준다(전역 에러 토스트도 띄우지 않음).
export const publicAdsQuery = { query: { meta: { silentError: true } } };

export function toAdItems(
  response: Awaited<ReturnType<typeof generated.listPublicAds>> | undefined,
): AdCarouselItem[] | undefined {
  if (response?.status !== 200 || response.data.length === 0) return undefined;
  return response.data.map((ad) => ({
    src: ad.imageUrl,
    alt: ad.title,
    adId: ad.id,
    // 랜딩은 광고주 입력값이라 http(s)만 링크로 쓴다(javascript: 등 차단).
    href: ad.landingUrl && /^https?:\/\//i.test(ad.landingUrl) ? ad.landingUrl : undefined,
  }));
}
