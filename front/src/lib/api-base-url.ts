/**
 * 브라우저 요청은 프론트의 same-origin rewrite를 사용한다.
 *
 * 백엔드 오리진을 브라우저에 직접 노출하면 API 응답 자체는 정상이어도
 * cross-origin credentials와 세션 쿠키 정책에 따라 fetch가 네트워크 오류로
 * 보일 수 있다. 서버 런타임에서는 기존처럼 배포 API 오리진을 사용한다.
 */
export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') return '/api';
  return process.env.NEXT_PUBLIC_API_URL ?? '/api';
}
