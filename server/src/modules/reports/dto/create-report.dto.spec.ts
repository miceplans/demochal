import 'reflect-metadata';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CreateReportDto } from './create-report.dto.js';

const base = {
  targetType: 'challenge',
  targetId: '123e4567-e89b-42d3-a456-426614174000',
  summary: '신고 사유',
};

describe('CreateReportDto', () => {
  it('accepts a payload with all target types', async () => {
    for (const targetType of ['challenge', 'team', 'award', 'user'] as const) {
      const dto = Object.assign(new CreateReportDto(), { ...base, targetType });

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    }
  });

  it('accepts an omitted targetId for award', async () => {
    const { targetId: _omitted, ...withoutTargetId } = base;
    const dto = Object.assign(new CreateReportDto(), { ...withoutTargetId, targetType: 'award' });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('rejects a non-UUID targetId', async () => {
    const dto = Object.assign(new CreateReportDto(), { ...base, targetId: 'not-a-uuid' });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(['targetId']);
  });
});
