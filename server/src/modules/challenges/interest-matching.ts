// 사용자 관심분야(온볍딩 '데이터 · AI' 계열, front user-design.ts preferenceGroups)와
// 챌린지 category('AI/데이터', 'IT/SW' 계열)는 어휘 체계가 달라 문자열 완전 일치로는
// 매칭되지 않는다. 추천(ChallengesService)과 마감/공고 알림 스캔이 공유하는
// 토큰 정규화 매칭 — 양쪽을 여기서 함께 바꿔야 정책이 어긋나지 않는다.

export function interestsMatch(interest: string, category: string | null): boolean {
  if (!category) return false;
  const interestTokens = normalizeInterestTokens(interest);
  const categoryTokens = normalizeInterestTokens(category);
  return interestTokens.some((interestToken) =>
    categoryTokens.some((categoryToken) => tokensMatch(interestToken, categoryToken)),
  );
}

// 2자 이하 영문/숫자 토큰(ai, it 등)은 부분 일치 시 mail/digital 같은 무관한 단어에
// 걸리므로 정확히 같을 때만 매칭한다. 한글 토큰(영상, 창업 등)은 부분 일치를 유지한다.
function tokensMatch(left: string, right: string): boolean {
  if (left === right) return true;
  const isShortAscii = (token: string) => /^[a-z0-9]{1,2}$/.test(token);
  if (isShortAscii(left) || isShortAscii(right)) return false;
  return left.includes(right) || right.includes(left);
}

function normalizeInterestTokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[·/\-_\s()]/g, ' ')
    .split(' ')
    .filter(Boolean);
}
