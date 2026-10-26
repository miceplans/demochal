import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CreateAdDto } from './create-ad.dto.js';

const validBody = {
  productId: 'hero',
  startDate: '2026-10-26',
  endDate: '2026-10-26',
  expectedDailyPrice: 100_000,
};

const errorsFor = (body: Record<string, unknown>) =>
  validateSync(plainToInstance(CreateAdDto, { ...validBody, ...body }));

describe('CreateAdDto', () => {
  it('accepts a string advertising product ID', () => {
    expect(errorsFor({ productId: 'hero' })).toHaveLength(0);
  });

  it.each(['', 123, null])('rejects an empty or non-string product ID: %s', (productId) => {
    expect(errorsFor({ productId })).not.toHaveLength(0);
  });
});
