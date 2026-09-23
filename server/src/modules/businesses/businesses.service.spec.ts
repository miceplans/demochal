import { describe, expect, it, vi } from 'vitest';
import { BusinessesService } from './businesses.service.js';

/** update().set().where().returning() chain. */
function createDbStub(updated: Record<string, unknown> | undefined) {
  const returning = vi.fn().mockResolvedValue(updated ? [updated] : []);
  const where = vi.fn().mockReturnValue({ returning });
  const set = vi.fn().mockReturnValue({ where });
  const update = vi.fn(() => ({ set }));
  const db: any = { update };
  return { db, set, where };
}

describe('BusinessesService', () => {
  it('scopes the update to the authenticated owner and applies only provided fields', async () => {
    const { db, set, where } = createDbStub({ id: 'biz-1', name: '새 이름' });
    const service = new BusinessesService(db);

    await service.update('biz-1', { name: '새 이름', bannerImageFileId: 'file-1' }, 'user-1');

    expect(set).toHaveBeenCalledWith({
      name: '새 이름',
      bannerImageFileId: 'file-1',
    });
    expect(where).toHaveBeenCalled();
  });

  it('rejects with NotFound when no row matches id and owner (no partial leak)', async () => {
    const { db } = createDbStub(undefined);
    const service = new BusinessesService(db);

    await expect(service.update('biz-2', { name: '새 이름' }, 'user-1')).rejects.toThrow(
      'Business not found or not owned by user',
    );
  });
});
