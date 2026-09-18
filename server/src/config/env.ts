import { randomBytes } from 'node:crypto';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

// No-op in production (ECS/Vercel inject env vars directly, no .env file present).
loadDotenv({ quiet: true });

const envSchema = z
  .object({
    NODE_ENV: z.string().default('development'),
    PORT: z.coerce.number().int().positive().default(3001),

    DATABASE_URL: z.string().default('postgres://localhost:5432/semochal'),

    AWS_REGION: z.string().default('ap-northeast-2'),

    S3_PUBLIC_BUCKET: z.string().default('semochal-public-dev'),
    S3_PRIVATE_BUCKET: z.string().default('semochal-private-dev'),

    SQS_VERIFICATIONS_QUEUE_URL: z.string().default(''),

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
  })
  .superRefine((value, ctx) => {
    if (value.NODE_ENV === 'production' && !value.JWT_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_SECRET'],
        message: 'JWT_SECRET must be set in production',
      });
    }
  });

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
}

const raw = parsed.data;

export const env = {
  nodeEnv: raw.NODE_ENV,
  port: raw.PORT,

  databaseUrl: raw.DATABASE_URL,

  awsRegion: raw.AWS_REGION,

  s3PublicBucket: raw.S3_PUBLIC_BUCKET,
  s3PrivateBucket: raw.S3_PRIVATE_BUCKET,

  sqsVerificationsQueueUrl: raw.SQS_VERIFICATIONS_QUEUE_URL,

  tossSecretKey: raw.TOSS_SECRET_KEY,

  clovaOcrApiUrl: raw.CLOVA_OCR_API_URL,
  clovaOcrSecretKey: raw.CLOVA_OCR_SECRET_KEY,

  ntsApiKey: raw.NTS_API_KEY,

  jwtSecret: raw.JWT_SECRET ?? randomBytes(32).toString('hex'),
  frontendOrigins: raw.FRONTEND_ORIGIN.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  apiPublicUrl: raw.API_PUBLIC_URL,
  publicAssetsBaseUrl: raw.PUBLIC_ASSETS_BASE_URL.replace(/\/+$/, ''),

  googleClientId: raw.GOOGLE_CLIENT_ID,
  googleClientSecret: raw.GOOGLE_CLIENT_SECRET,
  googleRedirectUri: raw.GOOGLE_REDIRECT_URI,
};
