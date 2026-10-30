import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { InterestsService } from './interests.service.js';

function updateSpy() {
  const set = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
  const db: any = { update: vi.fn().mockReturnValue({ set }) };
  return { db, set };
}

describe('InterestsService', () => {
  function selectDb(rows: unknown[]) {
    const limit = vi.fn().mockResolvedValue(rows);
    const where = vi.fn().mockReturnValue({ limit });
    const db: any = {
      select: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue({ where }) }),
    };
    return db;
  }

  it('getInterests returns the stored categories, or an empty list for a missing user', async () => {
    const db = selectDb([{ interests: ['디자인'], onboardingSurvey: null }]);
    const service = new InterestsService(db);

    await expect(service.getInterests('user-1')).resolves.toEqual({ categories: ['디자인'] });
  });

  it('getInterests falls back to the onboarding survey picks when nothing was saved yet', async () => {
    const db = selectDb([{ interests: [], onboardingSurvey: { interests: ['IT/SW', '취업'] } }]);
    const service = new InterestsService(db);

    await expect(service.getInterests('user-1')).resolves.toEqual({
      categories: ['IT/SW', '취업'],
    });
  });

  it('getInterests keeps saved categories authoritative over the onboarding survey', async () => {
    const db = selectDb([{ interests: ['디자인'], onboardingSurvey: { interests: ['IT/SW'] } }]);
    const service = new InterestsService(db);

    await expect(service.getInterests('user-1')).resolves.toEqual({ categories: ['디자인'] });
  });

  it('getInterests returns an empty list when the survey is missing or has no picks', async () => {
    const service = new InterestsService(selectDb([]));
    await expect(service.getInterests('missing')).resolves.toEqual({ categories: [] });

    const noSurvey = new InterestsService(selectDb([{ interests: [], onboardingSurvey: null }]));
    await expect(noSurvey.getInterests('user-1')).resolves.toEqual({ categories: [] });

    const emptySurvey = new InterestsService(
      selectDb([{ interests: [], onboardingSurvey: { interests: [] } }]),
    );
    await expect(emptySurvey.getInterests('user-1')).resolves.toEqual({ categories: [] });
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
