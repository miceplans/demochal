import { configureGeneratedApi } from '@semochal/api-client';
import { getApiBaseUrl } from './api-base-url';

// orval generated API(@semochal/api-client)의 공통 설정.
// 모듈 최상단에서 한 번만 실행되며, generated 훅이 fetch 전에 반드시 완료된다.
// 앱 전체 API 호출이 공유하는 유일한 HttpClient 인스턴스다(수기 클라이언트 createApiClient는 제거됨).
configureGeneratedApi({
  baseUrl: getApiBaseUrl(),
});
