import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { AdPricingEntryDto } from './update-ad-pricing.dto.js';

const errorsFor = (dailyPrice: unknown) =>
  validateSync(plainToInstance(AdPricingEntryDto, { slot: 'hero', dailyPrice }));

describe('AdPricingEntryDto', () => {
  it('accepts a positive integer price', () => {
    expect(errorsFor(50_000)).toHaveLength(0);
  });

  it.each([0, -1000, 1.5, 1_000_000_000])('rejects dailyPrice=%s', (value) => {
    expect(errorsFor(value)).not.toHaveLength(0);
  });
});
