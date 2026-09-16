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
  },
});
