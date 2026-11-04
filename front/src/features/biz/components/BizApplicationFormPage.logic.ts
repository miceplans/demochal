import { generated } from '@semochal/api-client';

type QuestionType = 'dropdown' | 'checkbox' | 'radio' | 'file' | 'short' | 'long';
type Question = {
  id: string;
  title: string;
  type: QuestionType;
  options: string[];
  required: boolean;
};

const isChoiceType = (type: QuestionType) =>
  type === 'dropdown' || type === 'checkbox' || type === 'radio';

const blankQuestion = (type: QuestionType = 'radio'): Question => ({
  // 저장된 질문 id(q-N)와 충돌하지 않도록 전역 유일 id를 쓴다(리뷰 #264-2).
  id: crypto.randomUUID(),
  title: '',
  type,
  options: isChoiceType(type) ? ['', ''] : [],
  required: false,
});

type ChallengeDetail = Extract<
  Awaited<ReturnType<typeof generated.getMyChallenge>>,
  { status: 200 }
>['data'];

export type { ChallengeDetail, Question, QuestionType };
export { blankQuestion, isChoiceType };
export { formatPeriod } from '@/utils/date';
