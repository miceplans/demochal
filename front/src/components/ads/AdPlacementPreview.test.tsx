import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GALLERY_LAYOUT, HERO_VIEWPORT_STYLE, MOBILE_HERO_LAYOUT, SLIDE_WIDTH } from './AdCarousel';
import { AdPlacementPreview, GALLERY_CROP_SPEC, HERO_CROP_SPEC } from './AdPlacementPreview';

type PublicAd = { id: string; title: string; imageUrl: string };

const mocks = vi.hoisted(() => ({
  heroData: undefined as { status: number; data: PublicAd[] } | undefined,
  galleryData: undefined as { status: number; data: PublicAd[] } | undefined,
}));

vi.mock('@semochal/api-client', () => ({
  generated: {
    useListPublicAds: ({ placement }: { placement: 'hero' | 'gallery' }) => ({
      data: placement === 'hero' ? mocks.heroData : mocks.galleryData,
    }),
  },
}));

describe('AdPlacementPreview', () => {
  beforeEach(() => {
    mocks.heroData = { status: 200, data: [] };
    mocks.galleryData = { status: 200, data: [] };
  });

  afterEach(() => {
    cleanup();
  });

  it('노출 중인 광고 개수만큼 페이저 점과 슬롯을 표시한다', () => {
    mocks.heroData = {
      status: 200,
      data: [
        { id: 'h1', title: '히어로 광고 1', imageUrl: 'https://cdn.example/hero-1.webp' },
        { id: 'h2', title: '히어로 광고 2', imageUrl: 'https://cdn.example/hero-2.webp' },
      ],
    };
    mocks.galleryData = {
      status: 200,
      data: [
        { id: 'g1', title: '갤러리 광고 1', imageUrl: 'https://cdn.example/gallery-1.webp' },
        { id: 'g2', title: '갤러리 광고 2', imageUrl: 'https://cdn.example/gallery-2.webp' },
      ],
    };

    const { container } = render(<AdPlacementPreview view="pc" onSelect={() => {}} />);

    // 페이저 점 개수가 실제 광고 개수와 같다.
    // 상단은 기본 세트(4개)보다 적어 부족한 2칸을 기본 광고로 채운다. 중간 기본 세트는 6개다.
    expect(screen.getByLabelText('상단 광고 1 / 4').children.length).toBe(4);
    expect(screen.getByLabelText('중간 광고 1 / 6').children.length).toBe(6);
    // 레일은 [채움, 1, 2, 채움 2개, 1] 순으로 렌더되므로 노출 광고 소재는 3개 슬롯에 나온다.
    const heroImgs = container.querySelectorAll('img[src^="https://cdn.example/hero-"]');
    expect(heroImgs.length).toBe(3);
    expect(container.querySelector('video[src="/assets/Hero-animation.webm"]')).not.toBeNull();
  });

  it('노출 광고가 1개여도 나머지 칸은 기본 광고로 채워 옆 슬롯이 보인다', () => {
    mocks.heroData = {
      status: 200,
      data: [
        { id: 'h1', title: '히어로 단일 광고', imageUrl: 'https://cdn.example/hero-only.webp' },
      ],
    };

    const { container } = render(<AdPlacementPreview view="pc" onSelect={() => {}} />);

    expect(screen.getByLabelText('상단 광고 1 / 4').children.length).toBe(4);
    // 옆 슬롯은 같은 광고 복제가 아니라 서로 다른 기본 광고다.
    expect(container.querySelector('video[src="/assets/Hero-animation.webm"]')).not.toBeNull();
    expect(container.querySelector('img[src="/assets/figma-ads/home-hero-2.png"]')).not.toBeNull();
    // 첫 슬롯이 복제 슬롯으로 오인되지 않아 alt가 비어 있지 않다.
    const img = container.querySelector<HTMLImageElement>(
      'img[src="https://cdn.example/hero-only.webp"]',
    );
    expect(img).not.toBeNull();
    expect(img!.alt).toBe('히어로 단일 광고');
  });

  it('노출 1개 상태에서 업로드하면 첫 슬롯만 교체되고 옆 슬롯은 기본 광고다', () => {
    mocks.heroData = {
      status: 200,
      data: [
        { id: 'h1', title: '히어로 단일 광고', imageUrl: 'https://cdn.example/hero-only.webp' },
      ],
    };

    const { container } = render(
      <AdPlacementPreview
        view="pc"
        onSelect={() => {}}
        uploadedImages={{ hero: 'blob:uploaded-hero' }}
      />,
    );

    expect(screen.getByLabelText('상단 광고 1 / 4').children.length).toBe(4);
    const uploaded = container.querySelector<HTMLImageElement>('img[src="blob:uploaded-hero"]');
    expect(uploaded).not.toBeNull();
    expect(uploaded!.alt).toBe('업로드한 홈 상단 광고 이미지');
  });

  it('조회 완료로 광고 수가 3에서 1로 줄어도 기본 광고로 채워 보인다', () => {
    const { container, rerender } = render(<AdPlacementPreview view="pc" onSelect={() => {}} />);

    mocks.heroData = {
      status: 200,
      data: [
        { id: 'h1', title: '히어로 단일 광고', imageUrl: 'https://cdn.example/hero-only.webp' },
      ],
    };
    rerender(<AdPlacementPreview view="pc" onSelect={() => {}} />);

    expect(screen.getByLabelText('상단 광고 1 / 4').children.length).toBe(4);
    const img = container.querySelector<HTMLImageElement>(
      'img[src="https://cdn.example/hero-only.webp"]',
    );
    expect(img).not.toBeNull();
    expect(img!.alt).toBe('히어로 단일 광고');
  });

  it('두 레일의 슬롯 수가 같아도 key 충돌 없이 렌더된다', () => {
    const singleAd = [{ id: 'h1', title: '단일 광고', imageUrl: 'https://cdn.example/only.webp' }];
    mocks.heroData = { status: 200, data: singleAd };
    mocks.galleryData = { status: 200, data: singleAd };
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { rerender } = render(<AdPlacementPreview view="pc" onSelect={() => {}} />);
    mocks.heroData = {
      status: 200,
      data: [
        ...singleAd,
        { id: 'h2', title: '두 번째 광고', imageUrl: 'https://cdn.example/second.webp' },
      ],
    };
    rerender(<AdPlacementPreview view="pc" onSelect={() => {}} />);

    const keyConflicts = consoleError.mock.calls.filter((args) =>
      String(args[0]).includes('same key'),
    );
    consoleError.mockRestore();
    expect(keyConflicts.length).toBe(0);
  });

  it('노출 광고가 없으면 홈과 같은 기본 광고(상단 4개, 중간 6개)를 보여준다', () => {
    const { container } = render(<AdPlacementPreview view="pc" onSelect={() => {}} />);

    expect(screen.getByLabelText('상단 광고 1 / 4').children.length).toBe(4);
    expect(screen.getByLabelText('중간 광고 1 / 6').children.length).toBe(6);
    // 홈 상단 기본 소재의 첫 번째는 자동재생이 허용되는 muted 영상이다.
    const video = container.querySelector<HTMLVideoElement>(
      'video[src="/assets/Hero-animation.webm"]',
    );
    expect(video).not.toBeNull();
    expect(video!.muted).toBe(true);
    expect(video!.autoplay).toBe(true);
    expect(video!.loop).toBe(true);
    expect(video!.playsInline).toBe(true);
    expect(container.querySelector('img[src="/assets/figma-ads/home-hero-2.png"]')).not.toBeNull();
  });

  it('공개 광고 조회가 실패하거나 응답이 없으면 기본 광고로 낮춘다', () => {
    mocks.heroData = { status: 500, data: [] };
    mocks.galleryData = undefined;

    const { container } = render(<AdPlacementPreview view="pc" onSelect={() => {}} />);

    expect(screen.getByLabelText('상단 광고 1 / 4').children.length).toBe(4);
    expect(screen.getByLabelText('중간 광고 1 / 6').children.length).toBe(6);
    expect(container.querySelector('video[src="/assets/Hero-animation.webm"]')).not.toBeNull();
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
    expect(container.querySelector('img[src="/assets/figma-ads/home-gallery.png"]')).not.toBeNull();
    expect(screen.getByLabelText('상단 광고 1 / 4').children.length).toBe(4);
  });

  it('업로드 모드에서는 해당 레일만 업로더 프레임을 보여주고 다른 레일은 유지한다', () => {
    const { container } = render(
      <AdPlacementPreview view="pc" onSelect={() => {}} uploadPlacement="hero" />,
    );

    // hero 레일의 모든 슬롯(기본 4개 + 복제 2개)이 업로더다.
    const fileInputs = container.querySelectorAll('input[type="file"][accept="image/*"]');
    expect(fileInputs.length).toBe(6);
    expect(screen.getAllByText('파일 찾기').length).toBe(6);
    // hero 레일만 업로더로 바뀌었다면 hero 고유 소재인 영상은 사라지고 gallery 소재는 남는다.
    expect(container.querySelector('video')).toBeNull();
    expect(container.querySelector('img[src="/assets/figma-ads/home-gallery.png"]')).not.toBeNull();
  });

  it('업로드 처리 중에는 안내 문구가 바뀐다', () => {
    render(
      <AdPlacementPreview view="pc" onSelect={() => {}} uploadPlacement="gallery" processing />,
    );

    expect(screen.getAllByText('이미지 처리 중...').length).toBeGreaterThan(0);
  });

  it('모바일 뷰에서도 실제 광고 수와 같은 페이저를 보여준다', () => {
    render(<AdPlacementPreview view="mobile" onSelect={() => {}} />);

    expect(screen.getByLabelText('모바일 사용자 홈 광고 미리보기')).not.toBeNull();
    expect(screen.getByLabelText('상단 광고 1 / 4')).not.toBeNull();
  });

  it('업로드 크롭 사양은 각 뷰의 실제 홈 노출 비율과 동기화돼 있다', () => {
    // 크롭 사양은 AdCarousel의 노출 레이아웃 상수와 직접 맞물려야 한다 — 어느 쪽이 바뀌면
    // 이 테스트가 실패해야 한다(리터럴 재서술 금지).
    const pcHeroHeight = Number.parseInt(HERO_VIEWPORT_STYLE.height, 10);
    expect(HERO_CROP_SPEC.mobile.aspectRatio).toBe(
      MOBILE_HERO_LAYOUT.width / MOBILE_HERO_LAYOUT.height,
    );
    expect(HERO_CROP_SPEC.mobile.previewWidth).toBe(MOBILE_HERO_LAYOUT.width);
    expect(HERO_CROP_SPEC.pc.aspectRatio).toBe(SLIDE_WIDTH.hero / pcHeroHeight);
    expect(HERO_CROP_SPEC.pc.previewWidth).toBe(SLIDE_WIDTH.hero);
    expect(GALLERY_CROP_SPEC.pc.aspectRatio).toBe(
      GALLERY_LAYOUT.pc.width / GALLERY_LAYOUT.pc.height,
    );
    expect(GALLERY_CROP_SPEC.pc.previewWidth).toBe(GALLERY_LAYOUT.pc.width);
    expect(GALLERY_CROP_SPEC.mobile.aspectRatio).toBe(
      GALLERY_LAYOUT.mobile.width / GALLERY_LAYOUT.mobile.height,
    );
    expect(GALLERY_CROP_SPEC.mobile.previewWidth).toBe(GALLERY_LAYOUT.mobile.width);
  });
});
