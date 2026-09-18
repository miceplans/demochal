import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  S3Client,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { eq } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { env } from '../../config/env.js';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
import { files } from '../../db/schema.js';
import {
  type AllowedUploadContentType,
  type PresignedUploadRequest,
} from './dto/presigned-upload-request.dto.js';

const EXTENSION_BY_CONTENT_TYPE: Record<AllowedUploadContentType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

function hasExpectedMagicBytes(contentType: AllowedUploadContentType, bytes: Uint8Array): boolean {
  const startsWith = (...signature: number[]) =>
    signature.every((byte, index) => bytes[index] === byte);
  switch (contentType) {
    case 'image/jpeg':
      return startsWith(0xff, 0xd8, 0xff);
    case 'image/png':
      return startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
    case 'image/webp':
      return startsWith(0x52, 0x49, 0x46, 0x46) && startsWithAt(bytes, 8, 0x57, 0x45, 0x42, 0x50);
    case 'application/pdf':
      return startsWith(0x25, 0x50, 0x44, 0x46, 0x2d);
  }
}

function startsWithAt(bytes: Uint8Array, offset: number, ...signature: number[]): boolean {
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

@Injectable()
export class FilesService {
  private readonly s3 = new S3Client({ region: env.awsRegion });

  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async requestUpload(dto: PresignedUploadRequest, uploaderUserId: string) {
    if (dto.bucket === 'public' && dto.contentType === 'application/pdf') {
      throw new BadRequestException('PDF files can only be uploaded to the private bucket.');
    }

    // Never write an untrusted object directly to the public bucket.  A caller
    // must finalize it, which verifies the actual bytes before promotion.
    const key = `pending/${uuid()}.${EXTENSION_BY_CONTENT_TYPE[dto.contentType]}`;

    const [file] = await this.db
      .insert(files)
      .values({
        bucket: 'private',
        requestedBucket: dto.bucket,
        key,
        contentType: dto.contentType,
        uploadStatus: 'pending',
        uploaderUserId,
      })
      .returning();

    const uploadUrl = await getSignedUrl(
      this.s3,
      new PutObjectCommand({
        Bucket: env.s3PrivateBucket,
        Key: key,
        ContentType: dto.contentType,
        ContentLength: dto.sizeBytes,
      }),
      { expiresIn: 60 * 5 },
    );

    // insert().returning() always yields the inserted row.
    return { uploadUrl, fileId: file!.id, key };
  }

  async finalizeUpload(id: string, userId: string) {
    const file = await this.findOwnedFile(id, userId);
    if (file.uploadStatus === 'ready') return file;

    const head = await this.s3.send(
      new HeadObjectCommand({ Bucket: env.s3PrivateBucket, Key: file.key }),
    );
    if (
      head.ContentType !== file.contentType ||
      !head.ContentLength ||
      head.ContentLength > 10 * 1024 * 1024
    ) {
      await this.rejectUpload(file.key, id);
      throw new NotFoundException('Uploaded file is invalid');
    }

    const object = await this.s3.send(
      new GetObjectCommand({ Bucket: env.s3PrivateBucket, Key: file.key, Range: 'bytes=0-31' }),
    );
    const bytes = new Uint8Array(await object.Body!.transformToByteArray());
    if (!hasExpectedMagicBytes(file.contentType as AllowedUploadContentType, bytes)) {
      await this.rejectUpload(file.key, id);
      throw new NotFoundException('Uploaded file is invalid');
    }

    const targetBucket =
      file.requestedBucket === 'public' ? env.s3PublicBucket : env.s3PrivateBucket;
    const targetKey =
      targetBucket === env.s3PrivateBucket
        ? file.key
        : `uploads/${file.id}.${EXTENSION_BY_CONTENT_TYPE[file.contentType as AllowedUploadContentType]}`;
    if (targetBucket !== env.s3PrivateBucket) {
      await this.s3.send(
        new CopyObjectCommand({
          Bucket: targetBucket,
          Key: targetKey,
          CopySource: `${env.s3PrivateBucket}/${file.key}`,
          ContentType: file.contentType,
          MetadataDirective: 'REPLACE',
        }),
      );
      await this.s3.send(new DeleteObjectCommand({ Bucket: env.s3PrivateBucket, Key: file.key }));
    }

    const [readyFile] = await this.db
      .update(files)
      .set({ bucket: file.requestedBucket, key: targetKey, uploadStatus: 'ready' })
      .where(eq(files.id, id))
      .returning();
    return readyFile!;
  }

  private async rejectUpload(key: string, id: string) {
    await this.s3.send(new DeleteObjectCommand({ Bucket: env.s3PrivateBucket, Key: key }));
    await this.db.update(files).set({ uploadStatus: 'rejected' }).where(eq(files.id, id));
  }

  async findById(id: string, userId: string) {
    return this.findOwnedFile(id, userId);
  }

  // Lets a trusted backend caller (e.g. the verifications worker) hand a
  // private object to a third-party provider without making the bucket public.
  async getPrivateReadUrl(key: string): Promise<string> {
    return getSignedUrl(this.s3, new GetObjectCommand({ Bucket: env.s3PrivateBucket, Key: key }), {
      expiresIn: 60 * 5,
    });
  }

  async assertOwnedReadyPrivate(id: string, userId: string) {
    const file = await this.findOwnedFile(id, userId);
    if (file.uploadStatus !== 'ready' || file.bucket !== 'private') {
      throw new BadRequestException('A verified private file is required');
    }
    return file;
  }

  private async findOwnedFile(id: string, userId: string) {
    const [file] = await this.db.select().from(files).where(eq(files.id, id)).limit(1);
    if (!file || file.uploaderUserId !== userId) throw new NotFoundException('File not found');
    return file;
  }
}
