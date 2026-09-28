import { describe, expect, it, vi } from 'vitest';
import { BusinessesController } from './businesses.controller.js';
import type { BusinessesService } from './businesses.service.js';

const user = { id: 'user-1', email: 'biz@semochal.kr', name: '사업자', role: 'business' };

function createController() {
  const businessesService = {
    listMyChallenges: vi.fn(),
    findByOwnerOrThrow: vi.fn(),
    register: vi.fn(),
    findById: vi.fn(),
    update: vi.fn(),
  };
  const controller = new BusinessesController(businessesService as unknown as BusinessesService);
  return { controller, businessesService };
}

describe('BusinessesController', () => {
  it('returns the current owner business', async () => {
    const { controller, businessesService } = createController();
    businessesService.findByOwnerOrThrow.mockResolvedValue({ id: 'biz-1', name: '주식회사 새모' });

    await expect(controller.findMine(user)).resolves.toEqual({
      id: 'biz-1',
      name: '주식회사 새모',
    });
    expect(businessesService.findByOwnerOrThrow).toHaveBeenCalledWith('user-1');
  });

  it('updates only with the authenticated owner id', async () => {
    const { controller, businessesService } = createController();
    businessesService.update.mockResolvedValue({ id: 'biz-1', name: '새 이름' });
    const dto = { name: '새 이름', bannerImageFileId: 'file-1' };

    await expect(controller.update('biz-1', dto, user)).resolves.toEqual({
      id: 'biz-1',
      name: '새 이름',
    });
    expect(businessesService.update).toHaveBeenCalledWith('biz-1', dto, 'user-1');
  });

  it('propagates the service rejection when updating a business owned by someone else', async () => {
    const { controller, businessesService } = createController();
    businessesService.update.mockRejectedValue(
      new Error('Business not found or not owned by user'),
    );

    await expect(controller.update('biz-2', { name: '새 이름' }, user)).rejects.toThrow(
      'Business not found or not owned by user',
    );
    expect(businessesService.update).toHaveBeenCalledWith('biz-2', { name: '새 이름' }, 'user-1');
  });
});
