import { ApiError } from '@semochal/api-client';
import type { Answers } from './ApplicationQuestions';

// 서버가 신청을 거부하며 내려주는 무효 첨부파일 ID(없으면 빈 배열).
function invalidFileIdsOf(error: unknown): string[] {
  if (!(error instanceof ApiError) || !error.body || typeof error.body !== 'object') return [];
  const ids = (error.body as { invalidFileIds?: unknown }).invalidFileIds;
  return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : [];
}

function withoutFileIds(answers: Answers, fileIds: string[]): Answers {
  return Object.fromEntries(
    Object.entries(answers).map(([questionId, value]) => [
      questionId,
      Array.isArray(value)
        ? value.filter((id) => !fileIds.includes(id))
        : fileIds.includes(value)
          ? ''
          : value,
    ]),
  );
}

export { invalidFileIdsOf, withoutFileIds };
