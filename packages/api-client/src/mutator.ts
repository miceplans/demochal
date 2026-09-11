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

/** Orval mutator — generated 함수의 모든 호출을 공유 HttpClient로 라우팅한다. */
export async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const http = requireClient();
  const method = (options.method ?? 'GET').toUpperCase();
  const body = typeof options.body === 'string' ? (JSON.parse(options.body) as unknown) : undefined;

  switch (method) {
    case 'GET':
      return http.get<T>(url);
    case 'POST':
      return http.post<T>(url, body);
    case 'PUT':
      return http.put<T>(url, body);
    case 'PATCH':
      return http.patch<T>(url, body);
    case 'DELETE':
      return http.delete<T>(url);
    default:
      throw new Error(`api-client: unsupported HTTP method "${method}"`);
  }
}
