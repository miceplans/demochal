import { generated } from '@semochal/api-client';

export type Question = NonNullable<
  generated.UpdateChallengeMutationBody['applicationForm']
>[number];
export type Answers = Record<string, string | string[]>;

export const MAX_FILE_ANSWERS = 10;

/** 파일 답변은 예전 초안에 UUID 문자열 하나로 남아 있을 수 있어 배열로 맞춘다. */
export function fileAnswerIds(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

export function isAnswerValid(question: Question, value: string | string[] | undefined) {
  if (question.type === 'file') return !question.required || fileAnswerIds(value).length > 0;
  if (value === undefined) return !question.required;
  if (question.type === 'checkbox') {
    return (
      Array.isArray(value) &&
      (!question.required || value.length > 0) &&
      value.every((item) => question.options?.includes(item))
    );
  }
  if (typeof value !== 'string') return false;
  if (!value.trim()) return !question.required;
  if (question.type === 'radio' || question.type === 'dropdown')
    return Boolean(question.options?.includes(value));
  return value.length <= (question.type === 'long' ? 10000 : 500);
}

const isAnswered = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value.length > 0 : Boolean(value?.trim());

export { isAnswered };
