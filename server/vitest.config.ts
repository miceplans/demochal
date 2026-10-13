import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  // Resolves the path aliases declared in tsconfig.json, including the ones
  // added by `nest g library`.
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.spec.ts'],
    // Dummy values so unit-tested clients/guards pass their env presence checks.
    env: {
      JWT_SECRET: 'test-jwt-secret',
      NTS_API_KEY: 'test-nts-key',
      CLOVA_OCR_API_URL: 'https://ocr.test/recognize',
      CLOVA_OCR_SECRET_KEY: 'test-ocr-secret',
      TOSS_SECRET_KEY: 'test-toss-secret',
    },
    coverage: {
      provider: 'v8',
      // 현재 스냅샷(약 77/74/72/79)보다 살짝 낮춰 게이트는 실제로 걸되 통과한다 —
      // 임계값을 현재 값에 맞추면 커버리지가 한 줄이라도 빠질 때마다 깨진다.
      thresholds: {
        statements: 75,
        functions: 68,
        branches: 70,
        lines: 75,
      },
    },
  },
});
