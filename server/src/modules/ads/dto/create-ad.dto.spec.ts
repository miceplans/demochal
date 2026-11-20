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

  it.each(['', '   ', 123, null])('rejects an empty or non-string product ID: %s', (productId) => {
    expect(errorsFor({ productId })).not.toHaveLength(0);
  });

  it.each(['https://example.com/landing', 'http://example.com'])(
    'accepts an http(s) landing URL: %s',
    (landingUrl) => {
      expect(errorsFor({ landingUrl })).toHaveLength(0);
    },
  );

  it.each([
    'javascript:alert(1)',
    'data:text/html,<script></script>',
    'ftp://example.com/x',
    '//example.com',
  ])('rejects a non-http(s) landing URL: %s', (landingUrl) => {
    expect(errorsFor({ landingUrl })).not.toHaveLength(0);
  });
});
