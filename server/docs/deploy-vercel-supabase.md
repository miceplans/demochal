# Demo deploy: Vercel + Supabase

A separate, disposable deploy of this same `server` app for experimentation.
Production keeps running on AWS (ALB + ECS-style host + SQS worker, see
`infra/README.md`) — nothing here changes that path. No files under `src/`
were changed for behavior; only `main.ts` was split into `app.factory.ts` so
both entry points share one bootstrap.

Not covered: `worker.ts` (the SQS consumer). It's a long-running poll loop
and can't run as a Vercel function — leave `SQS_VERIFICATIONS_QUEUE_URL`
unset for this deploy and verification jobs simply won't process.

## 1. Create the Supabase project

1. [supabase.com](https://supabase.com) → New project.
2. Project Settings → Database → **Connection string** → copy the
   **Transaction pooler** URI (port `6543`), not the direct connection —
   Vercel functions are short-lived and would otherwise exhaust Postgres'
   connection limit.
3. Append `?sslmode=require` to it.

## 2. Push the schema

From `server/`, point `DATABASE_URL` at the Supabase pooler URL and run the
existing migration flow — no schema changes needed:

```bash
DATABASE_URL="postgres://postgres.xxxx:PASSWORD@aws-0-xxxx.pooler.supabase.com:6543/postgres?sslmode=require" \
  pnpm db:migrate
```

## 3. Create the Vercel project

1. Vercel dashboard → New Project → import this repo.
2. **Root Directory**: `server` (same monorepo pattern the `front` project
   already uses — Vercel installs from the workspace root automatically).
3. Framework preset: **Other**.
4. Environment variables — set at minimum:
   - `DATABASE_URL` (from step 1)
   - `NODE_ENV=production`
   - `JWT_SECRET` (required in production — `openssl rand -hex 32`)
   - `FRONTEND_ORIGIN` (the origin(s) allowed to call this API with credentials)
   - Any of `S3_*`, `TOSS_SECRET_KEY`, `CLOVA_OCR_*`, `NTS_API_KEY`,
     `GOOGLE_*` that the features you're testing need — see `.env.example`
     for the full list. Leave `SQS_VERIFICATIONS_QUEUE_URL` unset.
5. Deploy.

`server/vercel.json` runs `pnpm run build` (`nest build`, tsc-based) and
routes all paths to `api/index.js`, which boots the compiled app once per
cold start and reuses it across warm invocations.

## Why not build /api/*.ts directly on Vercel

Vercel's zero-config Node builder transpiles `/api/*.ts` with esbuild, which
doesn't implement `emitDecoratorMetadata` — Nest's dependency injection
breaks silently. Building through `nest build` (real `tsc`) first and having
`api/index.js` require the compiled `dist/app.factory.js` avoids that.
