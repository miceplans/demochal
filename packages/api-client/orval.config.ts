import { defineConfig } from 'orval';

export default defineConfig({
  semochal: {
    input: '../../server/docs/openapi.yaml',
    output: {
      target: './src/generated/api.ts',
      schemas: './src/generated/model',
      client: 'react-query',
      mock: false,
      prettier: false,
      override: {
        // generated 함수들이 src/mutator.ts의 apiFetch를 통해 공유 HttpClient를 사용하도록 한다.
        mutator: { path: './src/mutator.ts', name: 'apiFetch' },
        query: {
          // 주의: useQuery/useMutation을 명시적으로 true로 설정하면 모든 작업에
          // 적용되어 반대쪽 훅이 생성되지 않는다(orval v8의 분기 로직).
          // 기본값이 GET→쿼리, 비GET→mutation이므로 이 둘은 오버라이드하지 않는다.
          // 커서 기반 페이지네이션 엔드포인트는 useXxxInfinite 훅도 함께 생성한다.
          useInfinite: true,
          useInfiniteQueryParam: 'cursor',
        },
      },
    },
  },
});
