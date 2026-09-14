import { HttpClient, type HttpClientOptions } from './http';

let client: HttpClient | null = null;

/**
 * generated/orval API를 쓰기 전에 한 번 호출한다.
 * front/의 providers나 앱 진입점에서 createApiClient와 동일한 옵션으로 설정하면 된다.
 */
export function configureGeneratedApi(options: HttpClientOptions) {
  client = new HttpClient(options);
}

function requireClient(): HttpClient {
  if (!client) {
    throw new Error(
      'api-client: configureGeneratedApi() must be called before using the generated API.',
    );
  }
  return client;
}

/**
 * Orval mutator — generated 함수의 모든 호출을 공유 HttpClient로 라우팅한다.
 * orval의 fetch 클라이언트 컨벤션대로 {data, status, headers} 엔벨로프를 그대로 반환한다
 * (생성된 xxxResponse 타입이 이 형태를 기대함 — 컴포넌트에서는 `result.data.data`로 접근).
 */
export async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const http = requireClient();
  return http.send(url, options) as Promise<T>;
}
