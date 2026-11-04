import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CreateRefundRequestDto, RejectRefundRequestDto } from './refund-request.dto.js';

describe.each([
  ['CreateRefundRequestDto', CreateRefundRequestDto],
  ['RejectRefundRequestDto', RejectRefundRequestDto],
])('%s reason', (_name, Dto) => {
  const errorsFor = (reason: unknown) => validate(plainToInstance(Dto, { reason }));

  it('accepts a normal reason', async () => {
    expect(await errorsFor('단순 변심')).toHaveLength(0);
  });

  it.each(['', ' ', '   ', '\n\t '])('rejects blank reason %j', async (reason) => {
    expect(await errorsFor(reason)).not.toHaveLength(0);
  });

  it('rejects non-strings and over-long reasons', async () => {
    expect(await errorsFor(123)).not.toHaveLength(0);
    expect(await errorsFor('가'.repeat(1001))).not.toHaveLength(0);
  });
});
