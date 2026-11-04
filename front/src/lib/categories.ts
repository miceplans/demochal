/**
 * 챌린지 category는 여러 분야를 콤마로 저장할 수 있다.
 * 크롤링 유입 공고는 종목 그룹과 대상이 공백·`·`로 이어 붙은 하나의 문자열(예: "아이디어·창업·마케팅·네이밍 일반인 대학생")로 저장한다.
 * 화면에서는 종목별로 나눠 빈 값·중복·대상 어휘를 정리해 분야별 태그로 렌더링한다.
 */
// 대상(지원자격) 어휘는 challenges targets 선택지(user-design.ts challengeTargets)와 같다 — category 문자열에 섞여 들어온 대상 값이다.
const TARGET_WORDS = new Set([
  '제한없음',
  '어린이',
  '초등학생',
  '중학생',
  '고등학생',
  '대학생',
  '대학원생',
  '일반인',
  '기업',
  '기타',
]);

export function splitCategories(category?: string | null): string[] {
  const tokens = [
    ...new Set(
      (category ?? '')
        .split(/[,·\s]+/)
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ];
  // 대상 어휘는 분야 태그에서 제외한다. 제외 결과가 빈 경우 원본 토큰을 유지해 분야가 비어 보이지 않게 한다.
  const fields = tokens.filter((token) => !TARGET_WORDS.has(token));
  return fields.length > 0 ? fields : tokens;
}
