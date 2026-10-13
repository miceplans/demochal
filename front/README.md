# front

세모챌 웹 프론트엔드 (Next.js 16 App Router + React 19).

## 실행

루트에서 `pnpm dev`를 실행하면 `@semochal/api-client` 빌드 후 front/server가 함께 뜬다.
front만 띄우려면 `pnpm --filter front dev` (기본 포트 3000).

## 스크립트

- `pnpm --filter front lint` / `typecheck` / `test` / `build`

## 규칙

- 서버 데이터는 TanStack Query + `@semochal/api-client`로만 호출한다 (`fetch` 직접 호출 금지).
- Zustand(`src/stores/useUserStore.ts`)는 클라이언트 전용 UI/개인화 상태만 둔다.
- 클라이언트 환경변수는 `NEXT_PUBLIC_*`만 사용한다.

자세한 프로젝트 규칙은 루트 `CLAUDE.md`를 따른다.
