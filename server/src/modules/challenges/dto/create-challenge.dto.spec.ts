import 'reflect-metadata';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CreateChallengeDto } from './create-challenge.dto.js';

const base = {
  businessId: '123e4567-e89b-42d3-a456-426614174000',
  title: '공고 제목',
  description: '공고 설명',
  price: 1000,
  capacity: 10,
  startDate: '2029-01-01T00:00:00Z',
  endDate: '2029-02-01T00:00:00Z',
};

describe('CreateChallengeDto', () => {
  it('accepts both recruitMethod values', async () => {
    for (const recruitMethod of ['seMOchall', 'external'] as const) {
      const dto = Object.assign(new CreateChallengeDto(), { ...base, recruitMethod });

      const errors = await validate(dto);

      expect(errors.map((error) => error.property)).not.toContain('recruitMethod');
    }
  });

  it('rejects recruitMethod values outside the seMOchall/external enum', async () => {
    for (const recruitMethod of ['semo', 'SEMOCHALL', 'google-form', '']) {
      const dto = Object.assign(new CreateChallengeDto(), { ...base, recruitMethod });

      const errors = await validate(dto);

      expect(errors.map((error) => error.property)).toEqual(['recruitMethod']);
    }
  });

  it('accepts a valid http(s) recruitUrl or omitting it entirely', async () => {
    for (const recruitUrl of [
      'https://example.com/apply',
      'http://forms.example.com/path?x=1',
      undefined,
    ]) {
      const dto = Object.assign(
        new CreateChallengeDto(),
        recruitUrl === undefined ? base : { ...base, recruitUrl },
      );

      const errors = await validate(dto);

      expect(errors.map((error) => error.property)).not.toContain('recruitUrl');
    }
  });

  it('rejects an invalid or non-http(s) recruitUrl', async () => {
    for (const recruitUrl of ['not-a-url', 'ftp://example.com/file', '   ', 'example.com']) {
      const dto = Object.assign(new CreateChallengeDto(), { ...base, recruitUrl });

      const errors = await validate(dto);

      expect(errors.map((error) => error.property)).toEqual(['recruitUrl']);
    }
  });

  it('rejects a recruitUrl longer than 2048 characters', async () => {
    const recruitUrl = `https://example.com/${'a'.repeat(2040)}`;
    const dto = Object.assign(new CreateChallengeDto(), { ...base, recruitUrl });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(['recruitUrl']);
  });
});
