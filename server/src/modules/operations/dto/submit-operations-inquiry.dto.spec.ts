import 'reflect-metadata';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { SubmitOperationsInquiryDto } from './submit-operations-inquiry.dto.js';

describe('SubmitOperationsInquiryDto', () => {
  it('rejects values beyond the database-backed inquiry limits', async () => {
    const dto = Object.assign(new SubmitOperationsInquiryDto(), {
      name: '가'.repeat(101),
      contact: '1'.repeat(201),
      content: '문'.repeat(4001),
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['name', 'contact', 'content']),
    );
  });
});
