import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { AD_MAX_DAYS, adPeriod, adToday } from './ad-period.js';

const plusDays = (days: number) =>
  new Date(adToday().getTime() + days * 86_400_000).toISOString().slice(0, 10);

describe('adPeriod', () => {
  it('counts start and end dates inclusively', () => {
    expect(adPeriod(plusDays(1), plusDays(3)).days).toBe(3);
  });

  it('allows a contract of exactly one year (365 days)', () => {
    expect(adPeriod(plusDays(1), plusDays(AD_MAX_DAYS)).days).toBe(AD_MAX_DAYS);
  });

  it('rejects a contract longer than one year', () => {
    expect(() => adPeriod(plusDays(1), plusDays(AD_MAX_DAYS + 1))).toThrow(BadRequestException);
    expect(() => adPeriod(plusDays(1), plusDays(AD_MAX_DAYS + 1))).toThrow('최대 1년');
  });

  it('still rejects past or inverted periods', () => {
    expect(() => adPeriod(plusDays(-1), plusDays(1))).toThrow(BadRequestException);
    expect(() => adPeriod(plusDays(3), plusDays(1))).toThrow(BadRequestException);
  });
});
