import { Inject, Injectable } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
import { certificates } from '../../db/schema.js';
import { FilesService } from '../files/files.service.js';
import type { CreateCertificateDto } from './dto/create-certificate.dto.js';

@Injectable()
export class CertificatesService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly filesService: FilesService,
  ) {}

  async create(dto: CreateCertificateDto, userId: string) {
    await this.filesService.assertOwnedReadyPrivate(dto.fileId, userId);
    const [certificate] = await this.db
      .insert(certificates)
      .values({
        userId,
        title: dto.title,
        category: dto.category,
        fileId: dto.fileId,
        status: 'pending',
      })
      .returning();
    return certificate!;
  }

  listMine(userId: string) {
    return this.db
      .select()
      .from(certificates)
      .where(eq(certificates.userId, userId))
      .orderBy(desc(certificates.createdAt));
  }
}
