import { describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';

// env는 모듈 임포트 시점에 파싱되므로, FilesService를 불러오기 전에 CDN 기본 URL을 고정한다.
vi.hoisted(() => {
  process.env.PUBLIC_ASSETS_BASE_URL = 'https://cdn.test';
});

const { FilesService } = await import('./files.service.js');

type FileRow = {
  id: string;
  bucket: string;
  uploadStatus: string;
  key: string;
};

function fileRow(overrides: Partial<FileRow> = {}): FileRow {
  return {
    id: 'file-1',
    bucket: 'public',
    uploadStatus: 'ready',
    key: 'uploads/file-1.webp',
    ...overrides,
  };
}

// where은 `.limit(1)`로 체인되기도 하고(`assertReadyPublic`류) 그대로 await되기도 한다(`inArray` 배치).
function selectChain(rows: unknown[]) {
  const limit = vi.fn().mockResolvedValue(rows);
  const whereResult = Object.assign(Promise.resolve(rows), { limit });
  const where = vi.fn().mockReturnValue(whereResult);
  const from = vi.fn().mockReturnValue({ where });
  return { from, where };
}

function createService(rows: unknown[]) {
  const db = { select: vi.fn().mockReturnValue(selectChain(rows)) };
  return { service: new FilesService(db as any), db };
}

describe('FilesService.assertReadyPublic', () => {
  it('accepts a ready public file', async () => {
    const { service } = createService([fileRow()]);

    await expect(service.assertReadyPublic('file-1')).resolves.toMatchObject({ id: 'file-1' });
  });

  it('rejects with 400 for a missing, pending, or private file', async () => {
    const missing = createService([]);
    await expect(missing.service.assertReadyPublic('file-x')).rejects.toThrow(BadRequestException);

    const pending = createService([fileRow({ uploadStatus: 'pending' })]);
    await expect(pending.service.assertReadyPublic('file-1')).rejects.toThrow(BadRequestException);

    const privateBucket = createService([fileRow({ bucket: 'private' })]);
    await expect(privateBucket.service.assertReadyPublic('file-1')).rejects.toThrow(
      BadRequestException,
    );
  });
});

describe('FilesService.resolvePublicUrl', () => {
  it('returns the CDN URL for a ready public file', async () => {
    const { service } = createService([fileRow()]);

    await expect(service.resolvePublicUrl('file-1')).resolves.toBe(
      'https://cdn.test/uploads/file-1.webp',
    );
  });

  it('returns null without querying when no id is given', async () => {
    const { service, db } = createService([]);

    await expect(service.resolvePublicUrl(null)).resolves.toBeNull();
    await expect(service.resolvePublicUrl(undefined)).resolves.toBeNull();
    expect(db.select).not.toHaveBeenCalled();
  });

  it('returns null for missing or non-public-ready files', async () => {
    const missing = createService([]);
    await expect(missing.service.resolvePublicUrl('file-x')).resolves.toBeNull();

    const pending = createService([fileRow({ uploadStatus: 'pending' })]);
    await expect(pending.service.resolvePublicUrl('file-1')).resolves.toBeNull();
  });
});

describe('FilesService.findById', () => {
  it('lets anyone read a ready public file — its CloudFront URL is already public', async () => {
    const { service } = createService([fileRow({ uploaderUserId: 'owner-1' } as any)]);

    const file = await service.findById('file-1', 'visitor-1');

    expect(file).toMatchObject({ id: 'file-1', url: 'https://cdn.test/uploads/file-1.webp' });
  });

  it('still restricts non-public files to the uploader', async () => {
    const pending = createService([
      fileRow({ uploadStatus: 'pending', uploaderUserId: 'owner-1' } as any),
    ]);
    await expect(pending.service.findById('file-1', 'visitor-1')).rejects.toThrow('File not found');
    await expect(pending.service.findById('file-1', 'owner-1')).resolves.toMatchObject({
      id: 'file-1',
    });

    const privateBucket = createService([
      fileRow({ bucket: 'private', uploaderUserId: 'owner-1' } as any),
    ]);
    await expect(privateBucket.service.findById('file-1', 'visitor-1')).rejects.toThrow(
      'File not found',
    );

    const missing = createService([]);
    await expect(missing.service.findById('file-x', 'owner-1')).rejects.toThrow('File not found');
  });
});

describe('FilesService.resolvePublicUrls', () => {
  it('returns an empty map without querying for no ids', async () => {
    const { service, db } = createService([]);

    await expect(service.resolvePublicUrls([null, undefined])).resolves.toEqual(new Map());
    expect(db.select).not.toHaveBeenCalled();
  });

  it('resolves a batch of ids in one query, mapping missing files to null', async () => {
    const rows = [fileRow(), fileRow({ id: 'file-2', key: 'uploads/file-2.webp' })];
    const { service } = createService(rows);

    const result = await service.resolvePublicUrls(['file-1', 'file-2', 'file-1', 'file-missing']);

    expect(result.get('file-1')).toBe('https://cdn.test/uploads/file-1.webp');
    expect(result.get('file-2')).toBe('https://cdn.test/uploads/file-2.webp');
    expect(result.get('file-missing')).toBeNull();
  });
});
