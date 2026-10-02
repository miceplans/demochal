import { describe, expect, it } from 'vitest';
import { buildPreviewAds, fallbackAds } from './fallback-ads';

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

  it('노출 1개에 업로드하면 업로드 1개뿐인 목록이 된다', () => {
    expect(buildPreviewAds([live[0]], live, uploaded)).toEqual([uploaded]);
  });
});

describe('fallbackAds', () => {
  it('홈과 같은 구성(각 3개, 상단 첫 소재는 영상)을 유지한다', () => {
    expect(fallbackAds.hero).toHaveLength(3);
    expect(fallbackAds.hero[0].type).toBe('video');
    expect(fallbackAds.gallery).toHaveLength(3);
    expect(fallbackAds.gallery.every((ad) => ad.type !== 'video')).toBe(true);
  });
});
