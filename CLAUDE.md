# 세모챌 (semochall) 프로젝트 규칙

pnpm 모노레포(pnpm 12, Node 20). 워크스페이스: `front`(Next.js 16 App Router + React 19), `server`(NestJS + Drizzle + SQS 워커), `packages/api-client`(orval 생성 클라이언트), `packages/config`(공유 tsconfig). 브랜치 `main` 기준, PR 단위 작업.

주요 스크립트(루트): `pnpm dev`(scripts/dev.mjs가 api-client 빌드 + front/server 동시 실행), `pnpm build`, `pnpm lint`, `pnpm typecheck`, `pnpm format:check`. PR 머지 전 `ci.yml`의 format:check → lint → typecheck → server 테스트 → 빌드 + Docker 빌드가 통과해야 한다.

## Front 규칙 (`front/`)

- **상태 경계**: 서버 데이터는 전부 TanStack Query가 담당한다. Zustand는 클라이언트 전용 UI/개인화 상태(북마크, 관심사, 알림 설정, 온보팅 플래그 등)만 — `front/src/stores/useUserStore.ts`가 유일한 스토어이며 이 패턴을 유지한다. 서버 응답을 Zustand에 캐시하지 않는다. Query 기본값(`front/src/app/providers.tsx`): `staleTime: 30_000`, `retry: 1`, `refetchOnWindowFocus: false`, 전역 에러는 QueryCache/MutationCache onError 토스트.
- **API 호출**: `fetch` 직접 호출 금지 — 반드시 `@semochal/api-client`(orval 생성, react-query 클라이언트)를 경유한다(`packages/api-client/README.md` 규칙). 엔드포인트 추가/변경 시 `server/docs/openapi.yaml`을 고친 뒤 `pnpm --filter @semochal/api-client generate`로 재생성. 기존 수기 클라이언트(`createApiClient`)는 신규 코드에 사용하지 않는다.
- **환경변수**: 클라이언트 코드는 `NEXT_PUBLIC_*`만 사용. 서버 전용 값(BIZ_SUBDOMAIN, API_PROXY_TARGET 등)을 클라이언트 번들에 넣지 않는다.
- **스타일링**: Emotion + 테마(`front/src/styles/theme.ts` module augmentation). 디자인 토큰은 `styles/tokens.css` / `docs/design-tokens.md` 기준, 임의의 하드코딩 색상/폰트 값을 쓰지 않는다.
- `front/AGENTS.md`의 Next.js 에이전트 규칙 블록은 `next dev`가 자동 관리하므로 삭제하거나 수동 수정하지 않는다.

## Server 규칙 (`server/`)

- **구조**: NestJS 모듈 — auth, users, businesses, verifications, challenges, applications, orders, payments, files, notifications, ads. `DbModule`/`QueueModule`은 `@Global`. 인증은 전역 `JwtAuthGuard`(HttpOnly 쿠키 JWT)이며 매 요청 DB에서 유저를 다시 로드해 권한 변경이 즉시 반영된다(`modules/auth/jwt-auth.guard.ts`) — 이 동작을 우회하는 캐싱을 추가하지 않는다. 공개 엔드포인트는 `modules/auth/public.decorator.ts`의 `@Public()`으로 명시하고, 관리자 권한은 `AdminRoleGuard`로 검사한다.
- **Drizzle**: 스키마는 `server/src/db/schema/core.schema.ts` + `server/src/db/schema/features.schema.ts`로 나뉘어 있고, `server/src/db/schema.ts`는 이 둘을 재수출하는 배럴 파일이다(컨벤션: `uuid().defaultRandom()`, `jsonb.$type<>()`, `timestamp().defaultNow()`, varchar 상태값 + 코멘트로 유효값 나열). DB 접근은 `DRIZZLE` provider 주입으로만. 마이그레이션은 drizzle-kit으로 생성(`pnpm --filter @semochal/server db:generate`)하고 **현재는 수동 실행** — 코드에 자동 `migrate()` 호출을 추가하지 않는다. `db/schema-migration.spec.ts`가 0000 baseline과 마이그레이션 일치를 검증하므로, 스키마 변경 시 마이그레이션 파일 + 스펙을 함께 갱신해야 테스트가 깨지지 않는다.
- **워커**: `worker.ts`는 SQS(`SQS_VERIFICATIONS_QUEUE_URL`) 폧 루프만 돌리고 HTTP를 열지 않는다. 워커 전용 로직은 `worker.module.ts`에 등록된 모듈(현재 verifications, notifications)에만 둔다.
- **설정**: `config/env.ts`는 zod 스키마로 `process.env`를 검증한다(production에서 `JWT_SECRET` 누락 시 실패). 신규 환경변수는 여기 + `server/.env.example`에 함께 추가.

## 아키텍처 규칙(준수 필수)

- **Outbox 패턴**: DB 트랜잭션과 외부 부수효과(메시지 발송, 웹훅 처리, 알림)를 묶어야 하는 경우 Outbox 패턴을 적용한다. 현재 코드베이스에는 구현이 없으며, `verifications.service.ts`의 fire-and-forget SQS 발송과 Toss 웹훅 처리가 개선 대상이다. 이 패턴을 우회하는 방향으로 새 코드를 쓰지 않는다.
- **결제(Toss Payments)**: Toss 웹훅은 서명이 없으므로, 수신 즉시 신뢰해서 주문 상태를 바꾸지 않고 반드시 Toss API(`GET /v1/payments/{paymentKey}`)로 상태를 재조회해 대사한다(`payments.controller.ts` TODO 주석). 금액-주문 대사, 멱등 처리, `payments` 테이블 영속화를 함께 갖춘다. 미구현 상태(CANCELED 처리 등)를 조용히 스킵하지 않고 TODO로 명시한다.
- **개인정보(사업자등록증 등)**: 민감 문서는 반드시 private 버킷(`S3_PRIVATE_BUCKET`)에만 저장하고 presigned PUT(5분)으로만 접근한다(`modules/files/files.service.ts`). 공개/비공개 버킷 분리를 없애지 않는다. OCR/진위확인 결과(`ocrResult` 등)와 사업자번호를 로그에 남기지 않는다.
- **청소년 보호**: 현재는 `front/src/app/youth/` 정적 안내 페이지만 존재하며 정책 강제 로직은 없다. 연령 확인·보호 관련 코드를 추가할 경우 별도 검토를 거치고, 개인정보 수집 최소화 원칙을 적용한다.
- **Docker 분기**: `Dockerfile.api`와 `Dockerfile.worker`는 같은 소스, 같은 두 단계 빌드(`pnpm --filter @semochal/server...` + `nest build`)이며 차이는 `CMD`(dist/main.js vs dist/worker.js)뿐이다. 워커 이미지에 `EXPOSE`를 추가하거나 API/워커 중 한 쪽에만 의존성·빌드 단계를 넣는 분기를 만들지 않는다. 둘 다 `ci.yml`에서 빌드 검증되므로 Dockerfile 변경 시 로컬에서 `docker build --file server/Dockerfile.{api,worker} .`를 확인한다.
- **ECS Task Definition**(인프라 구성 시, `infra/README.md` 계획): API 서비스와 워커 서비스는 같은 태스크 정의 구조(같은 이미지, CMD 오버라이드와 환경변수만 다르게)로 유지한다. 워커에는 ALB 타깃을 붙이지 않는다.

## 코드 스타일

- Prettier(루트 `.prettierrc`): singleQuote, semi, printWidth 100, trailingComma all — `pnpm format`로 맞춘다.
- front: eslint 9 flat config(eslint-config-next). server: oxlint(`no-floating-promises`는 경고로라도 해결한다).
- server는 ESM(`"type": "module"`): 상대 import에 `.js` 접미사 필수. 전 워크스페이스 tsconfig `strict: true`, `packages/config/tsconfig.base.json`의 `noUncheckedIndexedAccess`를 서버는 상속한다.
- 미구현 사항은 조용히 비워두지 않고 `TODO` + 공식 문서 링크를 남긴다(기존 코드 관례).

## 테스트

- server: Vitest — `pnpm --filter @semochal/server test`(spec은 `**/*.spec.ts`). 스키마 변경 시 `db/schema-migration.spec.ts` 반영 필수.
- packages/api-client: Vitest — `pnpm --filter @semochal/api-client test`. CI(`ci.yml`)가 두 test 스텝을 모두 실행한다.
- front 테스트는 없다 — 새 테스트 프레임워크를 임의로 추가하지 않는다.

## CI/CD

- `ci.yml`: PR/push 시 format:check → lint → typecheck → server 테스트 → 빌드 + Docker 빌드. 배포 자격증명은 의도적으로 없음.
- `code-review-glm.yml`: PR 리뷰(claude-code-action → Z.AI GLM). 인라인 코멘트 작성에는 `pull-requests: write` 권한이 필요하다.
- `qodo-merge.yml`: PR-Agent 자동 describe/review/improve.
