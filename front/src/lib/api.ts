import { configureGeneratedApi } from '@semochal/api-client';

// orval 생성 API(@semochal/api-client)의 공통 설정.
// 모듈 최상단에서 한 번만 실행되며, generated 훅이 fetch 전에 반드시 완료된다.
configureGeneratedApi({
  baseUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001',
});
