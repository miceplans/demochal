import { S3Client, type S3ClientConfig } from '@aws-sdk/client-s3';
import { env } from '../../config/env.js';

// A custom endpoint (LocalStack in docker-compose) cannot serve the SDK's
// default virtual-hosted bucket URLs, so it always implies path-style.
export function buildS3ClientConfig(region: string, endpoint?: string): S3ClientConfig {
  const config: S3ClientConfig = { region };
  if (endpoint) {
    config.endpoint = endpoint;
    config.forcePathStyle = true;
  }
  return config;
}

export function createS3Client(): S3Client {
  return new S3Client(buildS3ClientConfig(env.awsRegion, env.s3Endpoint));
}
