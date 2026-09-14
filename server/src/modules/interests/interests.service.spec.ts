import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { InterestsService } from './interests.service.js';

function updateSpy() {
  const set = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
  const db: any = { update: vi.fn().mockReturnValue({ set }) };
  return { db, set };
}

describe('InterestsService', () => {
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
