import { Logger } from '@nestjs/common';

interface FetchJsonResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

export interface FetchJsonOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  signal?: AbortSignal;
  /** 호출자가 signal을 주지 않을 때만 쓰는 타임아웃(밀리초). 기본 10초. */
  timeoutMs?: number;
}

type FetchLike = (url: string, init?: FetchJsonOptions) => Promise<FetchJsonResponse>;

const DEFAULT_TIMEOUT_MS = 10_000;

const logger = new Logger('HttpClient');

// 아웃바운드 URL은 쿼리스트링에 비밀을 싣는다(NTS serviceKey, OAuth client_secret).
// 로그에는 origin+경로만 남긴다 — 쿼리는 절대 찍지 않는다.
export function urlForLog(rawUrl: string): string {
  try {
    const { origin, pathname } = new URL(rawUrl);
    return `${origin}${pathname}`;
  } catch {
    return '(unparseable-url)';
  }
}

// Fetches JSON over HTTP through globalThis.fetch, but typed against a local
// minimal response interface instead of the ambient fetch/Response globals.
// Some CI build environments resolve those ambient types incompletely, which
// breaks compilation on properties like `ok`/`json` even though the runtime
// behavior is identical. Runtime semantics are unchanged — this only pins the
// static types.
export async function fetchJson(
  url: string,
  options?: FetchJsonOptions,
): Promise<FetchJsonResponse> {
  const fetchImpl = globalThis.fetch as unknown as FetchLike;
  // 호출자가 signal을 직접 준 경우에는 그 신호를 그대로 존중한다(AbortSignal.timeout과
  // 외부 signal을 동시에 걸 수 없어 caller signal이 있으면 기본 타임아웃은 적용하지 않는다).
  const signal = options?.signal ?? AbortSignal.timeout(options?.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  logger.debug(`${options?.method ?? 'GET'} ${urlForLog(url)}`);
  return fetchImpl(url, options ? { ...options, signal } : { signal });
}
