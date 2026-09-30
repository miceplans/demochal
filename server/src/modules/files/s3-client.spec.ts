import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { describe, expect, it } from 'vitest';
import { buildS3ClientConfig } from './s3-client.js';

const TEST_CREDENTIALS = { accessKeyId: 'test', secretAccessKey: 'test' };

function clientWithOverride(endpoint?: string): S3Client {
  return new S3Client({
    ...buildS3ClientConfig('ap-northeast-2', endpoint),
    credentials: TEST_CREDENTIALS,
  });
}

function signPutUrl(client: S3Client): Promise<string> {
  return getSignedUrl(
    client,
    new PutObjectCommand({ Bucket: 'semochal-private-dev', Key: 'pending/a.png' }),
    { expiresIn: 300 },
  );
}

describe('buildS3ClientConfig', () => {
  it('uses the default AWS endpoint when no override is set', () => {
    expect(buildS3ClientConfig('ap-northeast-2')).toEqual({ region: 'ap-northeast-2' });
    expect(buildS3ClientConfig('ap-northeast-2', '')).toEqual({ region: 'ap-northeast-2' });
  });

  it('points the client at the override endpoint with path-style URLs', () => {
    expect(buildS3ClientConfig('ap-northeast-2', 'http://localhost:4566')).toEqual({
      region: 'ap-northeast-2',
      endpoint: 'http://localhost:4566',
      forcePathStyle: true,
    });
  });
});

describe('presigned upload URL shape', () => {
  it('signs a path-style URL against the override endpoint', async () => {
    const url = await signPutUrl(clientWithOverride('http://localhost:4566'));
    expect(url.startsWith('http://localhost:4566/semochal-private-dev/pending/a.png?')).toBe(true);
  });

  it('signs a virtual-hosted URL against AWS by default', async () => {
    const url = await signPutUrl(clientWithOverride());
    expect(new URL(url).host).toBe('semochal-private-dev.s3.ap-northeast-2.amazonaws.com');
  });
});
