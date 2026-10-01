import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { ChangePasswordDto } from './change-password.dto.js';

const password = (length: number) => 'a'.repeat(length);

describe('ChangePasswordDto', () => {
  it.each([7, 129])('rejects new passwords with length %i', async (length) => {
    const dto = plainToInstance(ChangePasswordDto, {
      currentPassword: password(8),
      newPassword: password(length),
      confirmNewPassword: password(length),
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain('newPassword');
  });

  it('accepts new passwords at both length boundaries', async () => {
    for (const length of [8, 128]) {
      const value = password(length);
      const dto = plainToInstance(ChangePasswordDto, {
        currentPassword: password(8),
        newPassword: value,
        confirmNewPassword: value,
      });
      await expect(validate(dto)).resolves.toHaveLength(0);
    }
  });

  it('rejects non-string passwords', async () => {
    const dto = plainToInstance(ChangePasswordDto, {
      currentPassword: password(8),
      newPassword: 12345678,
      confirmNewPassword: 12345678,
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain('newPassword');
    expect(errors.map((error) => error.property)).toContain('confirmNewPassword');
  });
});
