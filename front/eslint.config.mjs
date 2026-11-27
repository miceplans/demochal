import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // 인증 상태(/auth/me)는 AuthProvider만 구독하고, 화면은 useAuth()로 읽는다.
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/features/auth/AuthProvider.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[object.name='generated'][property.name='useGetMyAuthInfo']",
          message: '인증 상태는 useAuth()(@/features/auth/AuthProvider)로 읽으세요.',
        },
      ],
    },
  },
  // API 호출은 @semochal/api-client만 경유한다. 직접 fetch는 S3 presigned PUT 헬퍼(lib/upload.ts)만 허용.
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/lib/upload.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        {
          name: 'fetch',
          message:
            'fetch 직접 호출 금지: API는 @semochal/api-client, S3 presigned 업로드는 @/lib/upload를 쓰세요.',
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // tesseract.js 자체 호스팅 자산(minified) — copy-tesseract-assets.mjs가 생성한다.
    'public/tesseract/**',
  ]),
]);

export default eslintConfig;
