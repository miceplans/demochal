import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { adMaxEndDate, adPeriod } from './ad-period.js';

// 2026-11-23 10:00 KST
const NOW = new Date('2026-11-23T01:00:00Z');

describe('adPeriod', () => {
  it('accepts an end date exactly three months from today (KST)', () => {
    expect(adMaxEndDate(NOW).toISOString().slice(0, 10)).toBe('2027-02-23');
    const { days } = adPeriod('2026-11-23', '2027-02-23', NOW);
    expect(days).toBe(93);
  });

  it('rejects an end date beyond three months from today', () => {
    expect(() => adPeriod('2026-11-23', '2027-02-24', NOW)).toThrow(BadRequestException);
    expect(() => adPeriod('2026-11-23', '2027-02-24', NOW)).toThrow(/3개월 이내/);
  });

  it('rejects a far-future reservation that would overflow the order amount', () => {
    expect(() => adPeriod('2099-01-01', '9999-12-31', NOW)).toThrow(/3개월 이내/);
  });

  it('still rejects a start date before today', () => {
    expect(() => adPeriod('2026-11-22', '2026-11-30', NOW)).toThrow(/오늘 이후/);
  });
});
