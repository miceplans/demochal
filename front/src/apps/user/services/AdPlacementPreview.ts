import { generated } from '@semochal/api-client';

export type AdPreviewView = 'mobile' | 'pc';
export type AdPlacement = 'hero' | 'gallery';

const artwork = {
  pc: { width: 1200, background: '/assets/pc-screen.png' },
  mobile: { width: 358, background: '/assets/mobile-screen.png' },
} as const;

// 업로드 크롭 프레임은 각 뷰가 실제 홈에서 광고를 노출하는 비율과 같아야 한다 —
// AdCarousel의 히어로·갤러리 레이아웃(모바일·PC 모두 3.5:1, 갤러리 315:190·240:145)과 동기화한다.
export const HERO_CROP_SPEC = {
  pc: { aspectRatio: 900 / 257, previewWidth: 900 },
  mobile: { aspectRatio: 3.5, previewWidth: 350 },
} as const;
export const GALLERY_CROP_SPEC = {
  pc: { aspectRatio: 315 / 190, previewWidth: 315 },
  mobile: { aspectRatio: 240 / 145, previewWidth: 240 },
} as const;

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

export { artwork, toPreviewAds };
export { adInfo };
