import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { RegisterDto } from './register.dto.js';

const baseInput = {
  email: 'biz@semochal.kr',
  password: 'password123',
  name: '기업 담당자',
};

async function agreementsErrors(agreements: unknown) {
  const dto = plainToInstance(RegisterDto, { ...baseInput, agreements });
  const errors = await validate(dto);
  return errors.find((error) => error.property === 'agreements');
}

describe('RegisterDto agreements', () => {
  it('accepts every supported terms key', async () => {
    await expect(agreementsErrors(['terms', 'privacy', 'business'])).resolves.toBeUndefined();
  });

  it('accepts omitted agreements for existing clients', async () => {
    const dto = plainToInstance(RegisterDto, baseInput);
    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects unknown terms keys', async () => {
    const error = await agreementsErrors(['bogus']);
    expect(error).toBeDefined();
  });

  it('rejects duplicated terms keys', async () => {
    const error = await agreementsErrors(['terms', 'terms']);
    expect(error).toBeDefined();
  });
});
