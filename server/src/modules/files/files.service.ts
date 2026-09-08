import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { eq } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { env } from '../../config/env.js';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
import { files } from '../../db/schema.js';
import type { PresignedUploadRequest } from './dto/presigned-upload-request.dto.js';

@Injectable()
export class FilesService {
  private readonly s3 = new S3Client({ region: env.awsRegion });

  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async requestUpload(dto: PresignedUploadRequest) {
    const bucket = dto.bucket === 'private' ? env.s3PrivateBucket : env.s3PublicBucket;
    const key = `${dto.bucket}/${uuid()}-${dto.fileName}`;

    const [file] = await this.db
      .insert(files)
      .values({ bucket: dto.bucket, key, contentType: dto.contentType })
      .returning();

    const uploadUrl = await getSignedUrl(
      this.s3,
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: dto.contentType,
      }),
      { expiresIn: 60 * 5 },
    );

    // insert().returning() always yields the inserted row.
    return { uploadUrl, fileId: file!.id, key };
  }

  async findById(id: string) {
    const [file] = await this.db.select().from(files).where(eq(files.id, id)).limit(1);
    if (!file) throw new NotFoundException('File not found');
    return file;
  }
}
