/**
 * 챌린지 category는 여러 분야를 콤마로 저장할 수 있다.
 * 화면에서는 공백·빈 값·중복을 정리해 분야별 태그로 렌더링한다.
 */
export function splitCategories(category?: string | null): string[] {
  return [
    ...new Set(
      (category ?? '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ];
}
