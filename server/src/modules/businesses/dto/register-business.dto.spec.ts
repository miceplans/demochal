import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { RegisterBusinessDto } from './register-business.dto.js';

describe('RegisterBusinessDto', () => {
  it.each([
    { type: '기업', registrationNumber: '123' },
    { type: '기업', registrationNumber: 'abcdefghij' },
    { type: 'other' },
  ])('rejects malformed input %#', (value) => {
    expect(validateSync(plainToInstance(RegisterBusinessDto, value))).not.toHaveLength(0);
  });
  it('accepts a school without a number', () => {
    expect(validateSync(plainToInstance(RegisterBusinessDto, { type: '학교' }))).toHaveLength(0);
  });
});
