// bz 서브도메인 레이블의 단일 해석 지점 — proxy.ts(middleware), lib/biz.ts,
// lib/payments.ts(클이언트)가 모두 이 값을 공유한다.
// NEXT_PUBLIC_BZ_SUBDOMAIN은 클라이언트 번들에 빌드 타임 인라이닝되고 서버에서는 런타임에 읽힌다.
// 서버 전용 BZ_SUBDOMAIN은 middleware/서버 컨텍스트의 폴드백으로만 동작하고, 클라이언트 번들에는
// 인라이닝되지 않아 undefined이므로 기본값 'bz'로 떨어진다(기존 lib/payments의 클라이언트 동작과 동일).
export const BZ_SUBDOMAIN =
  process.env.NEXT_PUBLIC_BZ_SUBDOMAIN ?? process.env.BZ_SUBDOMAIN ?? 'bz';
