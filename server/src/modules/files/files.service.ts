import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { eq, inArray } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { env } from '../../config/env.js';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
import { files } from '../../db/schema.js';
import {
  type AllowedUploadContentType,
  type PresignedUploadRequest,
} from './dto/presigned-upload-request.dto.js';
import { buildPublicFileUrl } from './public-file-url.js';
import { createS3Client } from './s3-client.js';

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
  private readonly s3 = createS3Client();

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

  private withPublicUrl<T extends typeof files.$inferSelect>(file: T): T & { url: string | null } {
    return { ...file, url: buildPublicFileUrl(file) };
  }

  async finalizeUpload(id: string, userId: string) {
    const file = await this.findOwnedFile(id, userId);
    if (file.uploadStatus === 'ready') return this.withPublicUrl(file);

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
    return this.withPublicUrl(readyFile!);
  }

  private async rejectUpload(key: string, id: string) {
    await this.s3.send(new DeleteObjectCommand({ Bucket: env.s3PrivateBucket, Key: key }));
    await this.db.update(files).set({ uploadStatus: 'rejected' }).where(eq(files.id, id));
  }

  async findById(id: string, userId: string) {
    const [file] = await this.db.select().from(files).where(eq(files.id, id)).limit(1);
    if (!file) throw new NotFoundException('File not found');
    // 공개 버킷의 업로드 완료 파일은 어차피 CloudFront 공개 URL로 누구나 볼 수 있으므로
    // (공고 포스터처럼) 업로더 본인만 조회할 수 있을 필요가 없다. 그 외 파일은 기존처럼 소유자만 조회한다.
    const publiclyServed = file.bucket === 'public' && file.uploadStatus === 'ready';
    if (!publiclyServed && file.uploaderUserId !== userId) {
      throw new NotFoundException('File not found');
    }
    return this.withPublicUrl(file);
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

  // 누구나 열어보는 컨텐츠(공고 포스터 등)에서 파일을 참조하기 전 검증한다.
  // 존재하지 않거나 pending/rejected/private 파일이면 FK 500·깨진 이미지를 막기 위해 400으로 거절한다.
  async assertReadyPublic(id: string) {
    const [file] = await this.db.select().from(files).where(eq(files.id, id)).limit(1);
    if (!file || file.uploadStatus !== 'ready' || file.bucket !== 'public') {
      throw new BadRequestException('A ready public file is required');
    }
    return file;
  }

  // public+ready 파일의 CDN URL을 돌려준다. 그 외 상태·비공개 파일은 null — 서버가 응답에
  // URL을 실어 별도 권한 없이 렌더할 수 있게 하는 전용 경로다.
  async resolvePublicUrl(id: string | null | undefined): Promise<string | null> {
    if (!id) return null;
    const [file] = await this.db.select().from(files).where(eq(files.id, id)).limit(1);
    return file ? buildPublicFileUrl(file) : null;
  }

  // 목록 응답용 — id들의 공개 URL을 한 번의 쿼리로 묶어 resolve한다.
  async resolvePublicUrls(ids: (string | null | undefined)[]): Promise<Map<string, string | null>> {
    const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
    if (unique.length === 0) return new Map();
    const rows = await this.db.select().from(files).where(inArray(files.id, unique));
    const rowById = new Map(rows.map((file) => [file.id, file]));
    return new Map(
      unique.map((id) => {
        const row = rowById.get(id);
        return [id, row ? buildPublicFileUrl(row) : null];
      }),
    );
  }

  private async findOwnedFile(id: string, userId: string) {
    const [file] = await this.db.select().from(files).where(eq(files.id, id)).limit(1);
    if (!file || file.uploaderUserId !== userId) throw new NotFoundException('File not found');
    return file;
  }
}
