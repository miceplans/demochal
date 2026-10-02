import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdPlacementPreview } from './AdPlacementPreview';

type PublicAd = { id: string; title: string; imageUrl: string };

const mocks = vi.hoisted(() => ({
  heroAds: [] as PublicAd[],
  galleryAds: [] as PublicAd[],
}));

vi.mock('@semochal/api-client', () => ({
  generated: {
    useListPublicAds: ({ placement }: { placement: 'hero' | 'gallery' }) => ({
      data: {
        status: 200,
        data: placement === 'hero' ? mocks.heroAds : mocks.galleryAds,
      },
    }),
  },
}));

describe('AdPlacementPreview', () => {
  beforeEach(() => {
    mocks.heroAds = [];
    mocks.galleryAds = [];
  });

  afterEach(() => {
    cleanup();
  });

  it('노출 중인 광고 개수만큼 페이저 점과 슬롯을 표시한다', () => {
    mocks.heroAds = [
      { id: 'h1', title: '히어로 광고 1', imageUrl: 'https://cdn.example/hero-1.webp' },
      { id: 'h2', title: '히어로 광고 2', imageUrl: 'https://cdn.example/hero-2.webp' },
    ];
    mocks.galleryAds = [
      { id: 'g1', title: '갤러리 광고 1', imageUrl: 'https://cdn.example/gallery-1.webp' },
      { id: 'g2', title: '갤러리 광고 2', imageUrl: 'https://cdn.example/gallery-2.webp' },
    ];

    const { container } = render(<AdPlacementPreview view="pc" onSelect={() => {}} />);

    expect(screen.getByLabelText('상단 광고 1 / 2')).not.toBeNull();
    expect(screen.getByLabelText('중간 광고 1 / 2')).not.toBeNull();
    // 무한 순환용 복제 슬롯 2개를 포함해 슬롯이 (광고 수 + 2)개 렌더된다.
    const heroImgs = container.querySelectorAll('img[src^="https://cdn.example/hero-"]');
    expect(heroImgs.length).toBe(4);
  });

  it('노출 광고가 없으면 홈과 같은 기본 광고 3개를 보여준다', () => {
    const { container } = render(<AdPlacementPreview view="pc" onSelect={() => {}} />);

    expect(screen.getByLabelText('상단 광고 1 / 3')).not.toBeNull();
    expect(screen.getByLabelText('중간 광고 1 / 3')).not.toBeNull();
    // 홈 상단 기본 소재의 첫 번째는 영상이다.
    expect(container.querySelector('video[src="/assets/Hero-animation.webm"]')).not.toBeNull();
    expect(container.querySelector('img[src="/assets/figma-ads/home-hero-2.png"]')).not.toBeNull();
  });

  it('업로드한 이미지는 해당 레일의 첫 슬롯 하나만 교체하고 나머지 슬롯은 유지한다', () => {
    const { container } = render(
      <AdPlacementPreview
        view="pc"
        onSelect={() => {}}
        uploadedImages={{ hero: 'blob:uploaded-hero' }}
      />,
    );

    // 첫 슬롯 1개 + 무한 순환용 끝 복제 1개만 업로드 이미지다.
    const uploadedSlots = container.querySelectorAll('img[src="blob:uploaded-hero"]');
    expect(uploadedSlots.length).toBe(2);
    // 나머지 슬롯은 기본 소재 그대로다.
    expect(container.querySelector('img[src="/assets/figma-ads/home-hero-2.png"]')).not.toBeNull();
    expect(container.querySelector('img[src="/assets/figma-ads/home-hero-3.png"]')).not.toBeNull();
    // 업로드하지 않은 gallery 레일은 기본 소재를 그대로 보여준다.
    expect(container.querySelector('img[src="/assets/figma-ads/home-hero-1.png"]')).not.toBeNull();
  });
});
