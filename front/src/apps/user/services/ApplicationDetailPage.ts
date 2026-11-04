import type { ApplicationFormAnswer } from '@semochal/api-client';
import type { Answers } from './ApplicationQuestions';

// 지원자 본인이 내용을 수정할 수 있는 상태 — 서버의 상태 가드와 동일하게 유지한다.
const EDITABLE_STATUSES = ['pending', 'submitted', 'needs_revision'];

/** 저장된 답변(questionId → value)을 편집 폼의 초기값으로 쓴다. */
function answersFromSaved(formAnswers: ApplicationFormAnswer[] | undefined): Answers {
  return Object.fromEntries((formAnswers ?? []).map((answer) => [answer.questionId, answer.value]));
}

export { answersFromSaved, EDITABLE_STATUSES };
