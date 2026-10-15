import type { NextConfig } from 'next';

// 로컬호스트 폰백은 개발 전용 — 프로덕션에서 API_PROXY_TARGET이 없으면 조용히 localhost로
// 프록시되지 않게 설정 로드 시점에 실패시킨다.
if (process.env.NODE_ENV === 'production' && !process.env.API_PROXY_TARGET) {
  throw new Error(
    '[next.config] 프로덕션에는 API_PROXY_TARGET(백엔드 API 오리진) 환경 변수가 필수입니다. 예: https://api.semochall.com',
  );
}

const apiProxyTarget = (process.env.API_PROXY_TARGET ?? 'http://localhost:3001').replace(/\/$/, '');

// CSP 허용 목록은 코드베이스에서 실제 로드하는 외부 호스트만 담는다:
// - 토스페이먼츠 SDK: js.tosspayments.com(스크립트), *.tosspayments.com(결제창 연결/iframe)
// - 구글 폰트(Material Symbols): fonts.googleapis.com(CSS), fonts.gstatic.com(폰트 파일)
// - 업로드 이미지(S3/CloudFront): 호스트가 배포 환경(PUBLIC_ASSETS_BASE_URL)마다 달라 img-src만 https: 허용
// - 소셜 로그인은 서버 경유 리다이렉트라 별도 도메인이 필요 없다
const scriptSrc = ["'self'", "'unsafe-inline'"];
if (process.env.NODE_ENV !== 'production') {
  // Next 개발 서버(HMR)가 eval을 쓴다 — 프로덕션에는 넣지 않는다.
  scriptSrc.push("'unsafe-eval'");
}
scriptSrc.push('https://js.tosspayments.com');

// - 파일 업로드: 브라우저가 서버가 내려준 presigned URL로 S3에 직접 PUT한다(리전은 서버 AWS_REGION과 같다).
const connectSrc = [
  "'self'",
  'https://*.tosspayments.com',
  'https://s3.ap-northeast-2.amazonaws.com',
  'https://*.s3.ap-northeast-2.amazonaws.com',
];
if (process.env.NODE_ENV !== 'production') {
  // docker-compose의 LocalStack(S3_ENDPOINT) — 개발 전용.
  connectSrc.push('http://localhost:4566');
}
const publicApiUrl = process.env.NEXT_PUBLIC_API_URL;
if (publicApiUrl?.startsWith('http')) {
  connectSrc.push(new URL(publicApiUrl).origin);
}

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src ${scriptSrc.join(' ')}`,
  `connect-src ${connectSrc.join(' ')}`,
  "img-src 'self' data: blob: https:",
  // 이미지 압축(browser-image-compression)이 blob: 워커를 쓴다.
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  'frame-src https://*.tosspayments.com',
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${apiProxyTarget}/:path*`,
      },
    ];
  },
};

export default nextConfig;
