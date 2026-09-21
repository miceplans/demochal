export interface HttpClientOptions {
  baseUrl: string;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(`API request failed with status ${status}`);
  }
}

export interface HttpEnvelope<T> {
  data: T;
  status: number;
  headers: Headers;
}

export class HttpClient {
  constructor(private readonly options: HttpClientOptions) {}

  /** orval mutator가 쓰는 경로 — {data, status, headers} 엔벨로프를 그대로 반환한다. */
  async send<T>(path: string, init: RequestInit = {}): Promise<HttpEnvelope<T>> {
    const headers = new Headers(init.headers);
    headers.set('Content-Type', 'application/json');

    const res = await fetch(`${this.options.baseUrl}${path}`, {
      ...init,
      headers,
      credentials: 'include',
    });

    if (!res.ok) {
      const body = await res.json().catch(() => undefined);
      throw new ApiError(res.status, body);
    }

    const data = res.status === 204 ? (undefined as T) : ((await res.json()) as T);
    return { data, status: res.status, headers: res.headers };
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const { data } = await this.send<T>(path, init);
    return data;
  }

  get<T>(path: string, init: RequestInit = {}) {
    return this.request<T>(path, { method: 'GET', ...init });
  }

  post<T>(path: string, body?: unknown) {
    return this.request<T>(path, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  patch<T>(path: string, body?: unknown) {
    return this.request<T>(path, {
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  put<T>(path: string, body?: unknown) {
    return this.request<T>(path, {
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  delete<T>(path: string) {
    return this.request<T>(path, { method: 'DELETE' });
  }
}
