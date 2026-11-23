import type { Contest } from '@/data/user-design';
import { daysUntil, isPastDeadline } from '@/lib/date';

// 챌린지 API 응답을 ContestCard 모델로 바꾼다(홈·사람찾기 추천 공용).
export function challengeToContest(
  challenge: {
    id?: string;
    title?: string;
    category?: string;
    endDate?: string;
    posterUrl?: string | null;
    thumbnailUrl?: string | null;
    prizeAmount?: number | null;
    teamCount?: number;
  },
  now: number,
): Contest {
  return {
    id: challenge.id ?? '',
    title: challenge.title ?? '챌린지',
    category: challenge.category ?? '기타',
    days: daysUntil(challenge.endDate, now),
    closed: isPastDeadline(challenge.endDate, now),
    // 공개 목록(GET /challenges)만 teamCount를 준다. 추천 등 값이 없는 응답은 0으로 꾸미지 않고 배지를 숨긴다.
    teams: challenge.teamCount,
    posterUrl: challenge.posterUrl ?? null,
    thumbnailUrl: challenge.thumbnailUrl ?? null,
    prizeAmount: challenge.prizeAmount ?? null,
  };
}
