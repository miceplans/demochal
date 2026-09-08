// Minimal env accessor. TODO: replace with a validated schema (e.g. zod) once
// the required variables stabilize.

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3001),

  databaseUrl: process.env.DATABASE_URL ?? 'postgres://localhost:5432/semochal',

  awsRegion: process.env.AWS_REGION ?? 'ap-northeast-2',

  s3PublicBucket: process.env.S3_PUBLIC_BUCKET ?? 'semochal-public-dev',
  s3PrivateBucket: process.env.S3_PRIVATE_BUCKET ?? 'semochal-private-dev',

  sqsVerificationsQueueUrl: process.env.SQS_VERIFICATIONS_QUEUE_URL ?? '',

  tossSecretKey: process.env.TOSS_SECRET_KEY ?? '',

  clovaOcrApiUrl: process.env.CLOVA_OCR_API_URL ?? '',
  clovaOcrSecretKey: process.env.CLOVA_OCR_SECRET_KEY ?? '',

  ntsApiKey: process.env.NTS_API_KEY ?? '',

  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
};
