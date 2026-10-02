import { hkdfSync, randomBytes } from 'node:crypto';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

// No-op in production (ECS/Vercel inject env vars directly, no .env file present).
loadDotenv({ quiet: true });

export const MIN_JWT_SECRET_LENGTH = 32;

const envSchema = z
  .object({
    NODE_ENV: z.string().default('development'),
    PORT: z.coerce.number().int().positive().default(3001),

    DATABASE_URL: z.string().default('postgres://localhost:5432/semochal'),
    DATABASE_SSL_CA_PATH: z.string().min(1).optional(),

    AWS_REGION: z.string().default('ap-northeast-2'),

    S3_PUBLIC_BUCKET: z.string().default('semochal-public-dev'),
    S3_PRIVATE_BUCKET: z.string().default('semochal-private-dev'),
    // Local S3-compatible endpoint (LocalStack). Empty keeps the default AWS endpoint.
    S3_ENDPOINT: z.union([z.literal(''), z.string().url()]).default(''),

    SQS_VERIFICATIONS_QUEUE_URL: z.string().default(''),

    // Service email delivery (SES). Empty in local dev — the email worker
    // no-ops and DB notifications keep working without either value.
    SES_FROM_EMAIL: z.string().default(''),
    SES_SUPPORT_FROM_EMAIL: z.string().default(''),
    SQS_EMAILS_QUEUE_URL: z.string().default(''),

    TOSS_SECRET_KEY: z.string().default(''),

    CLOVA_OCR_API_URL: z.string().default(''),
    CLOVA_OCR_SECRET_KEY: z.string().default(''),

    NTS_API_KEY: z.string().default(''),

    JWT_SECRET: z.string().min(1).optional(),
    FRONTEND_ORIGIN: z.string().default('http://localhost:3000'),
    API_PUBLIC_URL: z.string().url().default('http://localhost:3001'),
    // CloudFront domain fronting the public S3 bucket; used to build a
    // fully-formed URL for ready public files/ads instead of returning a
    // bare object key. Empty in local dev, where there is no CloudFront.
    PUBLIC_ASSETS_BASE_URL: z.string().default(''),

    GOOGLE_CLIENT_ID: z.string().default(''),
    GOOGLE_CLIENT_SECRET: z.string().default(''),
    GOOGLE_REDIRECT_URI: z.string().url().default('http://localhost:3001/auth/google/callback'),

    NAVER_CLIENT_ID: z.string().default(''),
    NAVER_CLIENT_SECRET: z.string().default(''),
    NAVER_REDIRECT_URI: z
      .string()
      .url()
      .default('http://localhost:3001/auth/social/naver/callback'),

    // Kakao "REST API 키" is the OAuth client_id. The client secret is optional and
    // only sent when enabled in Kakao Developers (앱 > 플랫폼 키 > 클라이언트 시크릿).
    KAKAO_CLIENT_ID: z.string().default(''),
    KAKAO_CLIENT_SECRET: z.string().default(''),
    KAKAO_REDIRECT_URI: z
      .string()
      .url()
      .default('http://localhost:3001/auth/social/kakao/callback'),
  })
  .superRefine((value, ctx) => {
    // HS256 key: anything shorter than 32 bytes is brute-forceable offline from one issued token.
    if (
      value.NODE_ENV === 'production' &&
      (value.JWT_SECRET?.length ?? 0) < MIN_JWT_SECRET_LENGTH
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_SECRET'],
        message: `JWT_SECRET must be set to at least ${MIN_JWT_SECRET_LENGTH} characters in production`,
      });
    }
  });

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
}

const raw = parsed.data;
const jwtSecret = raw.JWT_SECRET ?? randomBytes(32).toString('hex');

export const env = {
  nodeEnv: raw.NODE_ENV,
  port: raw.PORT,

  databaseUrl: raw.DATABASE_URL,
  databaseSslCaPath: raw.DATABASE_SSL_CA_PATH,

  awsRegion: raw.AWS_REGION,

  s3PublicBucket: raw.S3_PUBLIC_BUCKET,
  s3PrivateBucket: raw.S3_PRIVATE_BUCKET,
  s3Endpoint: raw.S3_ENDPOINT || undefined,

  sqsVerificationsQueueUrl: raw.SQS_VERIFICATIONS_QUEUE_URL,
  sesFromEmail: raw.SES_FROM_EMAIL,
  sesSupportFromEmail: raw.SES_SUPPORT_FROM_EMAIL,
  sqsEmailsQueueUrl: raw.SQS_EMAILS_QUEUE_URL,

  tossSecretKey: raw.TOSS_SECRET_KEY,

  clovaOcrApiUrl: raw.CLOVA_OCR_API_URL,
  clovaOcrSecretKey: raw.CLOVA_OCR_SECRET_KEY,

  ntsApiKey: raw.NTS_API_KEY,

  jwtSecret,
  // OAuth state HMAC key, derived (HKDF) so it never equals the session-signing key.
  oauthStateSecret: Buffer.from(hkdfSync('sha256', jwtSecret, '', 'semochal/oauth-state', 32)),
  frontendOrigins: raw.FRONTEND_ORIGIN.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  apiPublicUrl: raw.API_PUBLIC_URL,
  publicAssetsBaseUrl: raw.PUBLIC_ASSETS_BASE_URL.replace(/\/+$/, ''),

  googleClientId: raw.GOOGLE_CLIENT_ID,
  googleClientSecret: raw.GOOGLE_CLIENT_SECRET,
  googleRedirectUri: raw.GOOGLE_REDIRECT_URI,

  naverClientId: raw.NAVER_CLIENT_ID,
  naverClientSecret: raw.NAVER_CLIENT_SECRET,
  naverRedirectUri: raw.NAVER_REDIRECT_URI,

  kakaoClientId: raw.KAKAO_CLIENT_ID,
  kakaoClientSecret: raw.KAKAO_CLIENT_SECRET,
  kakaoRedirectUri: raw.KAKAO_REDIRECT_URI,
};
