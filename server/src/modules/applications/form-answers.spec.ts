import { describe, expect, it } from 'vitest';
import { validateFormAnswers } from './form-answers.js';
import type { ApplicationFormQuestion } from '../../db/schema.js';

const fileId = '11111111-1111-4111-8111-111111111111';
const question = (
  type: ApplicationFormQuestion['type'],
  required = true,
): ApplicationFormQuestion => ({
  id: type,
  title: `Question ${type}`,
  type,
  required,
  options: ['A', 'B'],
});

describe('application answer validation', () => {
  it('accepts all six types, stores server question snapshots, and preserves question order', () => {
    const form = (['short', 'long', 'dropdown', 'radio', 'checkbox', 'file'] as const).map((type) =>
      question(type),
    );
    const values = ['text', 'long text', 'A', 'B', ['A', 'B'], fileId];
    const answers = form.map((q, index) => ({ questionId: q.id, value: values[index]! })).reverse();
    expect(validateFormAnswers(form, answers)).toEqual(
      form.map((q, index) => ({
        questionId: q.id,
        title: q.title,
        type: q.type,
        value: values[index],
      })),
    );
  });

  it.each(['short', 'long', 'dropdown', 'radio', 'checkbox', 'file'] as const)(
    'requires an answer to required %s questions',
    (type) => {
      expect(() => validateFormAnswers([question(type)], [])).toThrow(
        'Invalid application form answers',
      );
      expect(validateFormAnswers([question(type, false)], [])).toEqual([
        { questionId: type, title: `Question ${type}`, type, value: type === 'checkbox' ? [] : '' },
      ]);
    },
  );

  it.each([
    ['short', ' '.repeat(5)],
    ['short', 'x'.repeat(501)],
    ['long', 'x'.repeat(10001)],
    ['short', []],
    ['long', {}],
    ['dropdown', 'tampered'],
    ['radio', ['A']],
    ['checkbox', 'A'],
    ['checkbox', ['A', 'A']],
    ['checkbox', ['unknown']],
    ['checkbox', [1]],
    ['file', 'not-a-uuid'],
    ['file', [fileId]],
  ])('rejects invalid %s answer values', (type, value) => {
    expect(() =>
      validateFormAnswers(
        [question(type as ApplicationFormQuestion['type'])],
        [{ questionId: String(type), value } as never],
      ),
    ).toThrow();
  });

  it('rejects unknown, duplicate, malformed, and oversized answer collections', () => {
    for (const input of [
      [{ questionId: 'unknown', value: 'A' }],
      [
        { questionId: 'short', value: 'A' },
        { questionId: 'short', value: 'B' },
      ],
      [null],
      Array(101).fill({ questionId: 'short', value: 'A' }),
    ]) {
      expect(() => validateFormAnswers([question('short')], input as never)).toThrow();
    }
    expect(() => validateFormAnswers(null, [{ questionId: 'unknown', value: 'A' }])).toThrow();
    expect(validateFormAnswers(null)).toEqual([]);
  });
});
