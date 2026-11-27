# @semochal/api-client

Shared types + typed HTTP client used by `front/` to call `server/`. `front/` must
never call `fetch` directly against the API — always go through this package.

**Only exception — presigned S3 uploads.** A presigned URL points at S3, not our API,
and its signature covers `Content-Type`, so it cannot go through `HttpClient`. All such
PUTs go through `front/src/lib/upload.ts` (`useFileUpload` = presign → PUT → finalize,
or the low-level `putToPresignedUrl`). That file is the only place allowed to call
`fetch`; ESLint (`no-restricted-globals`) rejects `fetch` everywhere else in `front/src`.

## Structure

- `src/types.ts` — hand-written shared types (kept for existing type imports).
- `src/http.ts` — `HttpClient` (baseUrl, cookie credentials, `ApiError`). The app
  creates exactly one instance via `configureGeneratedApi()`. The old hand-written
  `createApiClient` has been removed — use the generated client.
- `src/generated/` — **orval-generated** from the OpenAPI spec. Regenerate with
  `pnpm generate` after editing `server/docs/openapi.yaml`.
  `orval.config.ts` uses `client: 'react-query'`, so every operation becomes a
  TanStack Query hook (`useXxxQuery`, `useXxxMutation`; cursor-paginated GETs also
  get `useXxxInfinite`).
- `src/mutator.ts` — orval mutator. Routes every generated call through the
  shared `HttpClient` (baseUrl + auth cookie handling stay in one place).

## Using the generated hooks

```tsx
import { generated } from '@semochal/api-client';

const { data, isLoading } = generated.useListChallenges({ limit: 20 });
const { data: nextPage, fetchNextPage } = generated.useListChallengesInfinite({ limit: 20 });
const login = generated.useLogin({ mutation: { onSuccess: () => router.push('/') } });
```

`configureGeneratedApi()` must run once before the first generated call —
`front/src/lib/api.ts` already does this at module scope and is imported by
`front/src/app/providers.tsx`. The generated hooks share the app-wide
`QueryClient` from `front/src/app/providers.tsx` (staleTime, error toast, etc.).

Note: the spec covers both implemented and `planned` endpoints (see
`x-impl-status` in `server/docs/openapi.yaml`). Generated hooks for `planned`
endpoints exist but the server does not implement them yet.
