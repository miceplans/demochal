import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { GALLERY_CROP_SPEC, HERO_CROP_SPEC } from '@/components/ads/AdPlacementPreview';
import { PRICING_DIALOG_THUMB, PRICING_MOCK_LAYOUT } from './AdminAdPricingScreen';

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe('AdminAdPricingScreen 목업 레이아웃', () => {
  it('목업 광고 영역 비율은 실제 홈 노출 비율과 일치한다', () => {
    // 비율 원천(CROP_SPEC)이 바뀌면 이 테스트가 실패해야 한다 — 리터럴로 재서술하지 않는다.
    const { pc, mobile } = PRICING_MOCK_LAYOUT;
    expect(pc.heroCard.width / pc.heroCard.height).toBeCloseTo(HERO_CROP_SPEC.pc.aspectRatio, 1);
    expect(pc.galleryItem.width / pc.galleryItem.height).toBeCloseTo(
      GALLERY_CROP_SPEC.pc.aspectRatio,
      1,
    );
    expect(mobile.heroCard.width / mobile.heroCard.height).toBeCloseTo(
      HERO_CROP_SPEC.mobile.aspectRatio,
      1,
    );
    expect(mobile.galleryItem.width / mobile.galleryItem.height).toBeCloseTo(
      GALLERY_CROP_SPEC.mobile.aspectRatio,
      1,
    );
    expect(PRICING_DIALOG_THUMB.width / PRICING_DIALOG_THUMB.height).toBeCloseTo(
      HERO_CROP_SPEC.pc.aspectRatio,
      1,
    );
  });
});
