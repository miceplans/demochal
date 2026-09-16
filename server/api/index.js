// Vercel serverless entry point (demo/dev deploy only — production still runs
// server/src/main.ts as a persistent process behind the ALB, see infra/README.md).
//
// Plain JS on purpose: Vercel's zero-config Node builder transpiles /api/*.ts
// with esbuild, which does not support `emitDecoratorMetadata` and breaks
// Nest's DI. Building via `nest build` (tsc) first and requiring the compiled
// dist/ output here sidesteps that entirely.
//
// No adapter library needed: Vercel's Node runtime invokes this handler with
// real (req, res) objects, and an Express app is itself a valid
// `(req, res) => void` request listener — the same shape `http.createServer`
// takes — so it can be called directly.
import { createApp } from '../dist/app.factory.js';

let handlerPromise;

async function buildHandler() {
  const app = await createApp();
  await app.init();
  return app.getHttpAdapter().getInstance();
}

export default async function handler(req, res) {
  if (!handlerPromise) {
    handlerPromise = buildHandler();
  }
  try {
    const expressApp = await handlerPromise;
    return expressApp(req, res);
  } catch (err) {
    // Don't cache a failed cold start (e.g. DB unreachable) — retry next request.
    handlerPromise = undefined;
    throw err;
  }
}
