import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
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

describe('UsersService profile image', () => {
  const readyFile = {
    id: 'f0000000-0000-4000-8000-000000000001',
    bucket: 'public',
    uploadStatus: 'ready',
    key: 'uploads/f1.webp',
    contentType: 'image/webp',
    uploaderUserId: 'user-1',
  };
  const updatedUser = { id: 'user-1', passwordHash: 'x', profileImageFileId: readyFile.id };

  function profileDb(file: unknown) {
    const { db, set } = dbWith({ updated: [updatedUser], existing: file ? [file] : [] });
    return { db, set };
  }

  it('saves an own ready public image and returns it without the password hash', async () => {
    const { db, set } = profileDb(readyFile);
    const result = await new UsersService(db).updateProfile('user-1', {
      profileImageFileId: readyFile.id,
    });

    expect(set).toHaveBeenCalledWith({ profileImageFileId: readyFile.id });
    expect(result).not.toHaveProperty('passwordHash');
    expect(result).toHaveProperty('profileImageUrl');
  });

  it.each([
    ['missing', undefined],
    ['someone else’s', { ...readyFile, uploaderUserId: 'user-2' }],
    ['pending', { ...readyFile, uploadStatus: 'pending' }],
    ['private', { ...readyFile, bucket: 'private' }],
    ['non-image', { ...readyFile, contentType: 'application/pdf' }],
  ])('rejects a %s file', async (_label, file) => {
    const { db, set } = profileDb(file);

    await expect(
      new UsersService(db).updateProfile('user-1', { profileImageFileId: readyFile.id }),
    ).rejects.toThrow(BadRequestException);
    expect(set).not.toHaveBeenCalled();
  });

  it('clears the image when null is sent, without any file lookup', async () => {
    const { db, set } = dbWith({
      updated: [{ id: 'user-1', passwordHash: 'x', profileImageFileId: null }],
      existing: [],
    });
    const result = await new UsersService(db).updateProfile('user-1', { profileImageFileId: null });

    expect(set).toHaveBeenCalledWith({ profileImageFileId: null });
    expect(result.profileImageUrl).toBeNull();
    expect(db.select).not.toHaveBeenCalled();
  });
});
