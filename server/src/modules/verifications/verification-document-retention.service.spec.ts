import { describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import { VerificationDocumentRetentionService } from './verification-document-retention.service.js';

type Row = { id: string; key: string };

// selectDistinct().from().innerJoin().where().limit() returns the queued batches in order.
function createDb(batches: Row[][]) {
  const queue = [...batches];
  const where = vi.fn();
  const limit = vi.fn().mockImplementation(async () => queue.shift() ?? []);
  where.mockReturnValue({ limit });
  const innerJoin = vi.fn().mockReturnValue({ where });
  const from = vi.fn().mockReturnValue({ innerJoin });
  const selectDistinct = vi.fn().mockReturnValue({ from });

  const updateWhere = vi.fn().mockResolvedValue(undefined);
  const set = vi.fn().mockReturnValue({ where: updateWhere });
  const update = vi.fn().mockReturnValue({ set });
  return { db: { selectDistinct, update } as any, where, limit, set };
}

const policy = { retentionDays: 30, maxRetentionDays: 90 };
const now = new Date('2026-11-27T00:00:00.000Z');

describe('VerificationDocumentRetentionService.purgeExpired', () => {
  it('filters decided documents past retention or any document past the hard cap', async () => {
    const { db, where } = createDb([[]]);
    const service = new VerificationDocumentRetentionService(db, {} as any);

    await expect(service.purgeExpired(now, policy)).resolves.toEqual({ deleted: 0, failed: 0 });

    const query = new PgDialect().sqlToQuery(where.mock.calls[0]![0] as SQL);
    expect(query.sql).toContain('"files"."bucket" = $1');
    expect(query.sql).toContain('"files"."upload_status" <> $2');
    expect(query.sql).toContain('"verifications"."status" in ($3, $4)');
    expect(query.sql).toContain('"verifications"."updated_at" < $5');
    expect(query.sql).toContain('"verifications"."created_at" < $6');
    expect(query.params.slice(0, 4)).toEqual(['private', 'deleted', 'verified', 'rejected']);
    // timestamp params are serialized by the column mapper
    expect(String(query.params[4])).toContain('2026-10-28');
    expect(String(query.params[5])).toContain('2026-08-29');
  });

  it('deletes each expired document and clears the OCR result of its verifications', async () => {
    const { db, set } = createDb([[{ id: 'file-1', key: 'pending/a.pdf' }]]);
    const filesService = { deletePrivateFile: vi.fn().mockResolvedValue(undefined) };
    const service = new VerificationDocumentRetentionService(db, filesService as any);

    await expect(service.purgeExpired(now, policy)).resolves.toEqual({ deleted: 1, failed: 0 });

    expect(filesService.deletePrivateFile).toHaveBeenCalledWith({
      id: 'file-1',
      key: 'pending/a.pdf',
    });
    expect(set).toHaveBeenCalledWith({ ocrResult: null });
  });

  it('counts a failed delete, keeps going, and does not retry it in the same pass', async () => {
    const full = Array.from({ length: 100 }, (_, index) => ({
      id: `file-${index}`,
      key: `pending/${index}.pdf`,
    }));
    // Second query still returns the failed file (it was not marked deleted) plus nothing new.
    const { db, set } = createDb([full, [{ id: 'file-0', key: 'pending/0.pdf' }]]);
    const filesService = {
      deletePrivateFile: vi.fn().mockImplementation(async (file: Row) => {
        if (file.id === 'file-0') throw new Error('AccessDenied');
      }),
    };
    const service = new VerificationDocumentRetentionService(db, filesService as any);

    await expect(service.purgeExpired(now, policy)).resolves.toEqual({ deleted: 99, failed: 1 });
    expect(filesService.deletePrivateFile).toHaveBeenCalledTimes(100);
    // OCR results are cleared only for documents that were actually deleted.
    expect(set).toHaveBeenCalledTimes(99);
  });
});
