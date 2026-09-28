import 'reflect-metadata';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { UpdateChallengeDto } from './update-challenge.dto.js';

describe('UpdateChallengeDto', () => {
  it('accepts a valid http(s) recruitUrl or omitting it entirely', async () => {
    for (const recruitUrl of [
      'https://example.com/apply',
      'http://forms.example.com/path?x=1',
      undefined,
    ]) {
      const dto = Object.assign(
        new UpdateChallengeDto(),
        recruitUrl === undefined ? {} : { recruitUrl },
      );

      const errors = await validate(dto);

      expect(errors.map((error) => error.property)).not.toContain('recruitUrl');
    }
  });

  it('rejects an invalid or non-http(s) recruitUrl', async () => {
    for (const recruitUrl of ['not-a-url', 'ftp://example.com/file', '   ', 'example.com']) {
      const dto = Object.assign(new UpdateChallengeDto(), { recruitUrl });

      const errors = await validate(dto);

      expect(errors.map((error) => error.property)).toEqual(['recruitUrl']);
    }
  });

  it('rejects a recruitUrl longer than 2048 characters', async () => {
    const recruitUrl = `https://example.com/${'a'.repeat(2040)}`;
    const dto = Object.assign(new UpdateChallengeDto(), { recruitUrl });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(['recruitUrl']);
  });

  it('still allows clearing category with null while validating recruitUrl independently', async () => {
    const dto = Object.assign(new UpdateChallengeDto(), {
      category: null,
      recruitUrl: 'https://example.com/apply',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });
});
