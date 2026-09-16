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
}

type FetchLike = (url: string, init?: FetchJsonOptions) => Promise<FetchJsonResponse>;

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
  return fetchImpl(url, options);
}
