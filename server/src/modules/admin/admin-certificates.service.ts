import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, ilike } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
import { certificates, users } from '../../db/schema.js';

interface ListFilters {
  status?: 'pending' | 'verified' | 'rejected';
  q?: string;
}

@Injectable()
export class AdminCertificatesService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async list(filters: ListFilters) {
    const conditions = [
      filters.status ? eq(certificates.status, filters.status) : undefined,
      filters.q ? ilike(users.name, `%${filters.q}%`) : undefined,
    ].filter((c) => c !== undefined);

    const rows = await this.db
      .select({ certificate: certificates, userName: users.name })
      .from(certificates)
      .innerJoin(users, eq(certificates.userId, users.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(certificates.createdAt));

    return rows.map((row) => ({
      id: row.certificate.id,
      user: row.userName,
      award: row.certificate.title,
      category: row.certificate.category,
      fileId: row.certificate.fileId,
      status: row.certificate.status,
    }));
  }

  async verify(id: string, action: 'approve' | 'reject') {
    const status = action === 'approve' ? 'verified' : 'rejected';
    const [certificate] = await this.db
      .update(certificates)
      .set({ status })
      .where(eq(certificates.id, id))
      .returning();
    if (!certificate) throw new NotFoundException('Certificate not found');

    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, certificate.userId))
      .limit(1);

    if (status === 'verified' && user) {
      const badges = new Set(user.badges as string[]);
      badges.add(certificate.title);
      await this.db
        .update(users)
        .set({ badges: [...badges] })
        .where(eq(users.id, user.id));
    }

    return {
      id: certificate.id,
      user: user?.name,
      award: certificate.title,
      category: certificate.category,
      fileId: certificate.fileId,
      status: certificate.status,
    };
  }
}
