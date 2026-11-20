import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    // 결제 흐름 테스트가 실제 결제창 분기까지 도달하도록 결제 스위치를 켠다.
    env: { NEXT_PUBLIC_PAYMENTS_ENABLED: 'true' },
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
