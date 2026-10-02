import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { ApplyChallengeDto } from './apply-challenge.dto.js';

const challengeId = '11111111-1111-4111-8111-111111111111';
describe('ApplyChallengeDto answers', () => {
  it.each(
    [
      undefined,
      [],
      [{ questionId: 'q1', value: 'text' }],
      [{ questionId: 'q1', value: ['A'] }],
    ].map((formAnswers) => ({ formAnswers })),
  )('allows valid nested answers', async ({ formAnswers }) => {
    expect(
      await validate(plainToInstance(ApplyChallengeDto, { challengeId, formAnswers })),
    ).toHaveLength(0);
  });
  it.each(
    [
      [null],
      ['text'],
      [{ questionId: '', value: 'text' }],
      [{ questionId: 'q1' }],
      Array(101).fill({ questionId: 'q1', value: 'text' }),
    ].map((formAnswers) => ({ formAnswers })),
  )('rejects malformed nested answers', async ({ formAnswers }) => {
    const errors = await validate(plainToInstance(ApplyChallengeDto, { challengeId, formAnswers }));
    expect(errors.some((error) => error.property === 'formAnswers')).toBe(true);
  });
});
