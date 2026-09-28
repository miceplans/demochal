import { HttpClient, createApiClient } from '@semochal/api-client';

import { apiErrorMessage } from './api-error';

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
  return apiErrorMessage(
    error,
    '광고 정보를 처리하지 못했습니다. 로그인 및 서버 연결을 확인해 주세요.',
  );
}
