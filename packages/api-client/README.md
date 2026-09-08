# @semochal/api-client

Shared types + typed HTTP client used by `front/` to call `server/`. `front/` must
never call `fetch` directly against the API — always go through this package.

## Current state (manual)

`src/types.ts` and `src/client.ts` are hand-written and mirror the NestJS
controllers in `server/src/**`. Keep them in sync manually for now.

## Planned automation

1. `server/` generates an OpenAPI spec (e.g. via `@nestjs/swagger`'s
   `SwaggerModule.createDocument`) and writes it to `server/openapi.json`.
2. This package runs `openapi-typescript server/openapi.json -o src/generated/schema.d.ts`
   (or similar) to generate types.
3. `client.ts` is rewritten as a thin wrapper (e.g. `openapi-fetch`) over the
   generated schema instead of hand-written method signatures.

This is intentionally deferred until the API surface stabilizes.
