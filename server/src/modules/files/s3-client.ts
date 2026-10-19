import { S3Client, type S3ClientConfig } from '@aws-sdk/client-s3';
import { env } from '../../config/env.js';

// A custom endpoint (LocalStack in docker-compose) cannot serve the SDK's
// default virtual-hosted bucket URLs, so it always implies path-style.
export function buildS3ClientConfig(region: string, endpoint?: string): S3ClientConfig {
  // 최신 SDK는 기본으로 presigned PUT URL에 빈 본문의 CRC32(x-amz-checksum-crc32=AAAAAA==)를 서명해 넣는다.
  // 브라우저가 실제 파일을 PUT하면 체크섬이 맞지 않아 S3가 거절하므로 필요한 경우에만 계산하게 한다.
  // https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html
  const config: S3ClientConfig = { region, requestChecksumCalculation: 'WHEN_REQUIRED' };
  if (endpoint) {
    config.endpoint = endpoint;
    config.forcePathStyle = true;
  }
  return config;
}

export function createS3Client(): S3Client {
  return new S3Client(buildS3ClientConfig(env.awsRegion, env.s3Endpoint));
}
