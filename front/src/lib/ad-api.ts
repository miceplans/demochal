import { ApiError, HttpClient, createApiClient } from '@semochal/api-client';

const options = {
  baseUrl: process.env.NEXT_PUBLIC_API_URL ?? '/api',
};
export const adApi = createApiClient(options);
export const adHttp = new HttpClient(options);
export type AdPricing = {
  slot: string;
  dailyPrice: number;
  organization: string | null;
  period: string | null;
};
export function adError(error: unknown) {
  if (
    error instanceof ApiError &&
    error.body &&
    typeof error.body === 'object' &&
    'message' in error.body
  ) {
    const message = error.body.message;
    if (typeof message === 'string') return message;
  }
  return '광고 정보를 처리하지 못했습니다. 로그인 및 서버 연결을 확인해 주세요.';
}
