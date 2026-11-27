import { describe, expect, it } from 'vitest';
import {
  adDays,
  adNeedsContent,
  adPaymentAmount,
  adStatusLabel,
  firstAvailableAdStart,
  isAdEnded,
} from './BizAdsPage.logic';
import type { Ad } from './BizAdsPage.logic';

describe('광고 결제 기간 금액 계산', () => {
  it('시작일과 종료일을 모두 포함해 일수를 계산한다', () => {
    expect(adDays('2026-11-11', '2026-11-11')).toBe(1);
    expect(adDays('2026-11-11', '2026-11-12')).toBe(2);
  });

  it('선택 일수에 일 단가를 곱한다', () => {
    expect(adPaymentAmount('2026-11-11', '2026-11-13', 100_000)).toBe(300_000);
  });

  it('잘못된 날짜는 결제 화면에서 최소 1일로 취급한다', () => {
    expect(adDays('invalid', '2026-11-13')).toBe(1);
  });
});

describe('firstAvailableAdStart', () => {
  it('예약이 없으면 오늘부터 시작한다', () => {
    expect(firstAvailableAdStart([], '2026-11-11')).toBe('2026-11-11');
    expect(firstAvailableAdStart(undefined, '2026-11-11')).toBe('2026-11-11');
  });

  it('오늘을 포함한 예약이 있으면 그 예약 종료 다음 날부터 시작한다', () => {
    const reserved = [{ startDate: '2026-11-10', endDate: '2026-11-15' }];
    expect(firstAvailableAdStart(reserved, '2026-11-11')).toBe('2026-11-16');
  });

  it('연속된 예약을 모두 건드리고 시작일을 정한다', () => {
    const reserved = [
      { startDate: '2026-11-16T00:00:00.000Z', endDate: '2026-11-20T00:00:00.000Z' },
      { startDate: '2026-11-10', endDate: '2026-11-15' },
    ];
    expect(firstAvailableAdStart(reserved, '2026-11-11')).toBe('2026-11-21');
  });

  it('오늘과 겹치지 않는 예약은 시작일을 미루지 않는다', () => {
    const reserved = [{ startDate: '2026-12-01', endDate: '2026-12-31' }];
    expect(firstAvailableAdStart(reserved, '2026-11-11')).toBe('2026-11-11');
  });
});

function ad(overrides: Partial<Ad>): Ad {
  return {
    id: 'ad-1',
    businessId: 'biz-1',
    productId: 'hero',
    title: '광고',
    startDate: '2026-11-01T00:00:00.000Z',
    endDate: '2026-11-30T00:00:00.000Z',
    paidAmount: 100_000,
    status: 'active',
    imageUrl: 'https://cdn.example.com/ad.webp',
    ...overrides,
  };
}

describe('isAdEnded', () => {
  it('종료 상태이거나 종료일이 지난 광고를 종료로 본다', () => {
    expect(isAdEnded(ad({ status: 'ended' }), '2026-11-11')).toBe(true);
    expect(isAdEnded(ad({ endDate: '2026-11-10' }), '2026-11-11')).toBe(true);
    expect(isAdEnded(ad({ endDate: '2026-11-11' }), '2026-11-11')).toBe(false);
  });
});

describe('adNeedsContent', () => {
  it('진행 가능한 active 광고에 이미지가 없고 placement를 알 때만 등록 대상이다', () => {
    const noImage = ad({ imageUrl: null });
    expect(adNeedsContent(noImage, 'hero', '2026-11-11')).toBe(true);
    expect(adNeedsContent(noImage, null, '2026-11-11')).toBe(false);
    expect(adNeedsContent(ad({}), 'hero', '2026-11-11')).toBe(false);
    expect(adNeedsContent(ad({ status: 'paused', imageUrl: null }), 'hero', '2026-11-11')).toBe(
      false,
    );
    expect(
      adNeedsContent(ad({ imageUrl: null, endDate: '2026-11-01' }), 'hero', '2026-11-11'),
    ).toBe(false);
  });
});

describe('adStatusLabel', () => {
  it('광고 상태와 기간에 맞는 라벨을 고른다', () => {
    const today = '2026-11-11';
    expect(adStatusLabel(ad({ status: 'preparing' }), false, today)).toBe('결제 대기');
    expect(adStatusLabel(ad({ imageUrl: null }), true, today)).toBe('이미지 등록 필요');
    expect(adStatusLabel(ad({ endDate: '2026-11-10' }), false, today)).toBe('종료');
    expect(adStatusLabel(ad({ status: 'paused' }), false, today)).toBe('일시 정지');
    expect(adStatusLabel(ad({ startDate: '2026-11-12' }), false, today)).toBe('시작 대기');
    expect(adStatusLabel(ad({}), false, today)).toBe('진행중');
  });
});
