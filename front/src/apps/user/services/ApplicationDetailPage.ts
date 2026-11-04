import type { ApplicationFormAnswer } from '@semochal/api-client';
import type { Answers } from './ApplicationQuestions';

/** 저장된 답변(questionId → value)을 편집 폼의 초기값으로 쓴다. */
function answersFromSaved(formAnswers: ApplicationFormAnswer[] | undefined): Answers {
  return Object.fromEntries((formAnswers ?? []).map((answer) => [answer.questionId, answer.value]));
}

export { answersFromSaved };
export { EDITABLE_STATUSES } from '../constants/applications';
