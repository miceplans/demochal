import { ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { UsersService } from './users.service.js';

const survey = { interests: ['개발'], purposes: ['수상'], challengeTypes: ['공모전'] };

function dbWith({ updated, existing }: { updated: unknown[]; existing: unknown[] }) {
  const returning = vi.fn().mockResolvedValue(updated);
  const set = vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ returning }) });
  const limit = vi.fn().mockResolvedValue(existing);
  const db: any = {
    update: vi.fn().mockReturnValue({ set }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit }) }),
    }),
  };
  return { db, set };
}

describe('UsersService.saveOnboardingSurvey', () => {
  it('saves the survey for a user who has not completed it yet', async () => {
    const { db, set } = dbWith({ updated: [{ onboardingSurvey: survey }], existing: [] });
    const service = new UsersService(db);

    await expect(service.saveOnboardingSurvey('user-1', survey)).resolves.toEqual(survey);
    expect(set).toHaveBeenCalledWith({ onboardingSurvey: survey });
  });

  it('rejects a second submission once the survey is already stored', async () => {
    const { db } = dbWith({ updated: [], existing: [{ id: 'user-1', passwordHash: null }] });
    const service = new UsersService(db);

    await expect(service.saveOnboardingSurvey('user-1', survey)).rejects.toThrow(ConflictException);
  });

  it('returns 404 when the user does not exist', async () => {
    const { db } = dbWith({ updated: [], existing: [] });
    const service = new UsersService(db);

    await expect(service.saveOnboardingSurvey('missing', survey)).rejects.toThrow(
      NotFoundException,
    );
  });
});
