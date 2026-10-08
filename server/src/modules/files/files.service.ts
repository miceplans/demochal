import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { eq, inArray } from 'drizzle-orm';
import sharp from 'sharp';
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
  private readonly logger = new Logger(FilesService.name);
  private readonly s3 = createS3Client();

  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async requestUpload(dto: PresignedUploadRequest, uploaderUserId: string) {
    if (dto.bucket === 'public' && dto.contentType === 'application/pdf') {
      throw new BadRequestException('PDF 파일은 보안 저장소에만 업로드할 수 있습니다.');
    }

    // 공개 버킷의 이미지(광고·포스터·프로필 등)는 클라이언트 변환에 의존하지 않고 서버에서 WebP로 강제한다.
    if (dto.bucket === 'public' && dto.contentType !== 'image/webp') {
      throw new BadRequestException('공개 이미지는 WebP 형식만 업로드할 수 있습니다.');
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

    let head;
    try {
      head = await this.s3.send(
        new HeadObjectCommand({ Bucket: env.s3PrivateBucket, Key: file.key }),
      );
    } catch (error) {
      const name = (error as { name?: string } | undefined)?.name;
      if (name !== 'NotFound' && name !== 'NoSuchKey') throw error;
      // A concurrent finalize may have already promoted (and removed) the pending
      // object — return its result instead of failing.
      const current = await this.findOwnedFile(id, userId);
      if (current.uploadStatus === 'ready') return this.withPublicUrl(current);
      throw new NotFoundException(
        '업로드된 파일을 찾을 수 없습니다. 업로드를 마친 뒤 다시 시도해 주세요.',
      );
    }
    if (
      head.ContentType !== file.contentType ||
      !head.ContentLength ||
      head.ContentLength > 10 * 1024 * 1024
    ) {
      await this.rejectUpload(file.key, id);
      throw new NotFoundException('업로드된 파일이 유효하지 않습니다.');
    }

    const object = await this.s3.send(
      new GetObjectCommand({ Bucket: env.s3PrivateBucket, Key: file.key, Range: 'bytes=0-31' }),
    );
    const bytes = new Uint8Array(await object.Body!.transformToByteArray());
    if (!hasExpectedMagicBytes(file.contentType as AllowedUploadContentType, bytes)) {
      await this.rejectUpload(file.key, id);
      throw new NotFoundException('업로드된 파일이 유효하지 않습니다.');
    }

    const targetBucket =
      file.requestedBucket === 'public' ? env.s3PublicBucket : env.s3PrivateBucket;
    let convertedWebp: Buffer | undefined;
    if (targetBucket !== env.s3PrivateBucket && file.contentType !== 'image/webp') {
      try {
        const source = await this.s3.send(
          new GetObjectCommand({ Bucket: env.s3PrivateBucket, Key: file.key }),
        );
        const sourceBytes = Buffer.from(await source.Body!.transformToByteArray());
        convertedWebp = await sharp(sourceBytes).webp().toBuffer();
      } catch (error) {
        await this.rejectUpload(file.key, id);
        this.logger.warn(`Failed to convert upload ${id} to WebP`, error);
        throw new NotFoundException('업로드된 이미지 변환에 실패했습니다.');
      }
    }
    const targetKey =
      targetBucket === env.s3PrivateBucket
        ? file.key
        : `uploads/${file.id}.${convertedWebp ? 'webp' : EXTENSION_BY_CONTENT_TYPE[file.contentType as AllowedUploadContentType]}`;
    if (targetBucket !== env.s3PrivateBucket) {
      if (convertedWebp) {
        await this.s3.send(
          new PutObjectCommand({
            Bucket: targetBucket,
            Key: targetKey,
            Body: convertedWebp,
            ContentType: 'image/webp',
            ContentLength: convertedWebp.length,
          }),
        );
      } else {
        await this.s3.send(
          new CopyObjectCommand({
            Bucket: targetBucket,
            Key: targetKey,
            CopySource: `${env.s3PrivateBucket}/${file.key}`,
            ContentType: file.contentType,
            MetadataDirective: 'REPLACE',
          }),
        );
      }
    }

    const [readyFile] = await this.db
      .update(files)
      .set({
        bucket: file.requestedBucket,
        key: targetKey,
        contentType: convertedWebp ? 'image/webp' : file.contentType,
        uploadStatus: 'ready',
      })
      .where(eq(files.id, id))
      .returning();

    // Remove the pending original only after the DB points at the promoted copy —
    // deleting first would lose the file if the update failed. A failed delete
    // just leaves an orphan under pending/.
    if (targetBucket !== env.s3PrivateBucket) {
      try {
        await this.s3.send(new DeleteObjectCommand({ Bucket: env.s3PrivateBucket, Key: file.key }));
      } catch (error) {
        this.logger.warn(`Failed to delete promoted pending object for file ${id}`, error);
      }
    }
    return this.withPublicUrl(readyFile!);
  }

  private async rejectUpload(key: string, id: string) {
    await this.s3.send(new DeleteObjectCommand({ Bucket: env.s3PrivateBucket, Key: key }));
    await this.db.update(files).set({ uploadStatus: 'rejected' }).where(eq(files.id, id));
  }

  async findById(id: string, userId: string) {
    const [file] = await this.db.select().from(files).where(eq(files.id, id)).limit(1);
    if (!file) throw new NotFoundException('파일을 찾을 수 없습니다.');
    // 공개 버킷의 업로드 완료 파일은 어차피 CloudFront 공개 URL로 누구나 볼 수 있으므로
    // (공고 포스터처럼) 업로더 본인만 조회할 수 있을 필요가 없다. 그 외 파일은 기존처럼 소유자만 조회한다.
    const publiclyServed = file.bucket === 'public' && file.uploadStatus === 'ready';
    if (!publiclyServed && file.uploaderUserId !== userId) {
      throw new NotFoundException('파일을 찾을 수 없습니다.');
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
      throw new BadRequestException('검증된 개인 파일이 필요합니다.');
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
    if (!file || file.uploaderUserId !== userId)
      throw new NotFoundException('파일을 찾을 수 없습니다.');
    return file;
  }
}
