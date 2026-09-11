# @semochal/api-client

Shared types + typed HTTP client used by `front/` to call `server/`. `front/` must
never call `fetch` directly against the API — always go through this package.

## Structure

- `src/types.ts`, `src/client.ts`, `src/http.ts` — hand-written client
  (`createApiClient`). Kept for compatibility; will be retired once the generated
  client covers the used surface.
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
