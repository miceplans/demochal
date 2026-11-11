import { getApiErrorMessage } from '@semochal/api-client';

export const NETWORK_ERROR_MESSAGE =
  '서버에 연결할 수 없어요. 네트워크 연결을 확인한 뒤 다시 시도해 주세요.';

/**
 * 사용자에게 보여줄 에러 메시지를 정한다.
 * 1) 서버가 내려준 body.message(문자열/배열 첫 항목) — 실제 원인을 가장 정확히 설명한다.
 * 2) fetch가 브라우저에서 네트워크 연결 실패로 던지는 TypeError — 연결 오류로 안내한다.
 * 3) 서버 오류가 아닌 일반 Error — 오류가 제공한 메시지를 표시한다.
 * 4) 그 외(파싱 불가 body 등) — 호출자의 fallback 문구.
 */
export function apiErrorMessage(error: unknown, fallback: string): string {
  const serverMessage = getApiErrorMessage(error);
  if (serverMessage) return serverMessage;
  // Toss SDK/local validation 예외도 Error이므로 모든 Error를 네트워크 오류로
  // 분류하면 Network 탭에 요청이 없는 경우에도 잘못된 토스트가 표시된다.
  if (error instanceof TypeError) return NETWORK_ERROR_MESSAGE;
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}
