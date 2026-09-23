import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { InterestsService } from './interests.service.js';

function updateSpy() {
  const set = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
  const db: any = { update: vi.fn().mockReturnValue({ set }) };
  return { db, set };
}

describe('InterestsService', () => {
  it('getInterests returns the stored categories, or an empty list for a missing user', async () => {
    const limit = vi
      .fn()
      .mockResolvedValueOnce([{ interests: ['디자인'] }])
      .mockResolvedValueOnce([]);
    const where = vi.fn().mockReturnValue({ limit });
    const db: any = {
      select: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue({ where }) }),
    };
    const service = new InterestsService(db);

    await expect(service.getInterests('user-1')).resolves.toEqual({ categories: ['디자인'] });
    await expect(service.getInterests('missing')).resolves.toEqual({ categories: [] });
  });

  it('saveInterests stores categories and echoes them back', async () => {
    const { db, set } = updateSpy();
    const service = new InterestsService(db);

    const result = await service.saveInterests('user-1', { categories: ['개발', '디자인'] });

    expect(set).toHaveBeenCalledWith({ interests: ['개발', '디자인'] });
    expect(result).toEqual({ categories: ['개발', '디자인'] });
  });

  it('saveNotificationSettings flattens { enabled } wrappers to booleans', async () => {
    const { db, set } = updateSpy();
    const service = new InterestsService(db);

    const result = await service.saveNotificationSettings('user-1', {
      teamsMatching: { enabled: true },
      challengeDeadline: { enabled: false },
    });

    expect(set).toHaveBeenCalledWith({
      notificationSettings: { teamsMatching: true, challengeDeadline: false },
    });
    expect(result).toEqual({ teamsMatching: true, challengeDeadline: false });
  });

  it('saveNotificationSettings rejects non-boolean enabled values', async () => {
    const { db, set } = updateSpy();
    const service = new InterestsService(db);

    await expect(
      service.saveNotificationSettings('user-1', { teamsMatching: { enabled: 'yes' } } as any),
    ).rejects.toThrow(BadRequestException);
    expect(set).not.toHaveBeenCalled();
  });

  it('saveNotificationSettings rejects non-object settings', async () => {
    const { db, set } = updateSpy();
    const service = new InterestsService(db);

    await expect(
      service.saveNotificationSettings('user-1', { teamsMatching: 'on' } as any),
    ).rejects.toThrow(BadRequestException);
    expect(set).not.toHaveBeenCalled();
  });
});
