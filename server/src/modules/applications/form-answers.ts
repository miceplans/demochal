import { BadRequestException } from '@nestjs/common';
import { isUUID } from 'class-validator';
import type { ApplicationFormQuestion } from '../../db/schema.js';

export type AnswerInput = { questionId: string; value: string | string[] };
export type FormAnswer = AnswerInput & {
  title: string;
  type: ApplicationFormQuestion['type'];
};

/** Store server-derived question snapshots so later form edits do not relabel old answers. */
export function validateFormAnswers(
  questions: ApplicationFormQuestion[] | null | undefined,
  input: AnswerInput[] = [],
): FormAnswer[] {
  const form = questions ?? [];
  const invalid = () => {
    throw new BadRequestException('Invalid application form answers');
  };
  if (!Array.isArray(input) || input.length > 100) return invalid();
  const ids = new Set(form.map((question) => question.id));
  if (ids.size !== form.length) return invalid();
  const answers = new Map<string, unknown>();
  for (const answer of input) {
    if (!answer || !ids.has(answer.questionId) || answers.has(answer.questionId)) return invalid();
    answers.set(answer.questionId, answer.value);
  }
  return form.map((question) => {
    const value = answers.has(question.id)
      ? answers.get(question.id)
      : question.type === 'checkbox'
        ? []
        : '';
    if (question.type === 'checkbox') {
      if (
        !Array.isArray(value) ||
        value.length > 50 ||
        new Set(value).size !== value.length ||
        value.some((option) => typeof option !== 'string' || !question.options?.includes(option)) ||
        (question.required && value.length === 0)
      )
        return invalid();
      return { questionId: question.id, title: question.title, type: question.type, value };
    }
    if (typeof value !== 'string' || value.length > (question.type === 'long' ? 10000 : 500))
      return invalid();
    if (question.required && !value.trim()) return invalid();
    if (
      value &&
      (question.type === 'dropdown' || question.type === 'radio') &&
      !question.options?.includes(value)
    )
      return invalid();
    if (value && question.type === 'file' && !isUUID(value)) return invalid();
    return { questionId: question.id, title: question.title, type: question.type, value };
  });
}
