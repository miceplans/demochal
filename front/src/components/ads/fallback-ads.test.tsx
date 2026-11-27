import { describe, expect, it } from 'vitest';
import { buildPreviewAds, fallbackAds, fillWithFallback } from './fallback-ads';

const live = [
  { src: 'a.webp', alt: 'A' },
  { src: 'b.webp', alt: 'B' },
  { src: 'c.webp', alt: 'C' },
];
const uploaded = { src: 'blob:uploaded', alt: '업로드한 광고 이미지' };

describe('buildPreviewAds', () => {
  it('노출 목록이 없거나 비어 있으면 fallback을 그대로 쓴다', () => {
    expect(buildPreviewAds(undefined, live, undefined)).toEqual(live);
    expect(buildPreviewAds([], live, undefined)).toEqual(live);
  });

  it('업로드가 없으면 노출 목록을 그대로 쓴다', () => {
    expect(buildPreviewAds(live, live, undefined)).toEqual(live);
  });

  it('노출 N개에 업로드하면 첫 슬롯만 교체하고 나머지는 노출 목록을 유지한다', () => {
    expect(buildPreviewAds(live, live, uploaded)).toEqual([uploaded, live[1], live[2]]);
  });

  it('노출 1개에 업로드하면 첫 슬롯만 교체하고 나머지는 기본 광고로 채운다', () => {
    expect(buildPreviewAds([live[0]], live, uploaded)).toEqual([uploaded, live[1], live[2]]);
  });
});

describe('fillWithFallback', () => {
  it('노출 광고가 없으면 기본 세트를 그대로 쓴다', () => {
    expect(fillWithFallback(undefined, live)).toEqual(live);
  });

  it('부족한 만큼 겹치지 않는 기본 광고로 채운다', () => {
    expect(fillWithFallback([live[1]], live)).toEqual([live[1], live[0], live[2]]);
  });

  it('기본 세트 수 이상이면 그대로 둔다', () => {
    expect(fillWithFallback(live, live.slice(0, 2))).toEqual(live);
  });
});

describe('fallbackAds', () => {
  it('상단 5개(첫 소재는 영상, 둘째는 광고 문의 배너), 중간 6개를 각각 서로 다른 소재로 구성한다', () => {
    expect(fallbackAds.hero).toHaveLength(5);
    expect(fallbackAds.hero[0].type).toBe('video');
    expect(fallbackAds.hero[1]).toMatchObject({
      src: '/assets/ads/ad-inquiry.webp',
      href: '/biz/ad-inquiry',
    });
    expect(fallbackAds.gallery).toHaveLength(6);
    expect(fallbackAds.gallery.every((ad) => ad.type !== 'video')).toBe(true);
    expect(new Set(fallbackAds.hero.map((ad) => ad.src)).size).toBe(5);
    expect(new Set(fallbackAds.gallery.map((ad) => ad.src)).size).toBe(6);
  });

  it('모든 기본 광고를 SEMO 또는 SEMO.BIZ 자체 소재로만 구성한다', () => {
    const allFallbackAds = [...fallbackAds.hero, ...fallbackAds.gallery];

    expect(allFallbackAds.every((ad) => /SEMO(?:\.BIZ)?/i.test(ad.alt))).toBe(true);
    expect(allFallbackAds.map((ad) => ad.src)).not.toContain('/assets/figma-ads/home-gallery.webp');
    expect(allFallbackAds.map((ad) => ad.src)).not.toContain('/assets/figma-ads/home-hero.webp');
  });
});
