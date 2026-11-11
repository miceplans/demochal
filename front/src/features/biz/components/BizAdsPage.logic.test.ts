import { describe, expect, it } from 'vitest';
import { adDays, adPaymentAmount } from './BizAdsPage.logic';

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
