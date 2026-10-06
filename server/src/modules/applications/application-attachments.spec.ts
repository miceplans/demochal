import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import { files } from '../../db/schema.js';
import { ApplicationsService } from './applications.service.js';
import { ApplicationsController } from './applications.controller.js';

const fileId = '11111111-1111-4111-8111-111111111111';
const answer = { questionId: 'q1', title: '자료', type: 'file', value: fileId };
const record = (price = 0) => ({
  application: { id: 'app-1', userId: 'applicant', formAnswers: [answer] },
  businessOwnerId: 'owner',
  price,
});
function setup(rows: unknown[][]) {
  const conditions: { table: unknown; condition: any }[] = [];
  const db = {
    select: vi.fn(() => ({
      from: (table: unknown) => {
        const chain: any = {
          innerJoin: () => chain,
          where: (condition: unknown) => {
            conditions.push({ table, condition });
            return { limit: async () => rows.shift() ?? [] };
          },
        };
        return chain;
      },
    })),
  };
  return { service: new ApplicationsService(db as never), db, conditions };
}

describe('application attachments and answer access', () => {
  it.each(['applicant', 'owner'])('permits %s to read a referenced private file', async (user) => {
    // 신청자가 아닌 접근(업주)은 접수 확정 여부를 확인하는 조회가 한 번 더 있다.
    const { service, conditions } = setup([
      [record()],
      ...(user === 'owner' ? [[{ id: 'app-1' }]] : []),
      [{ id: fileId, key: 'private-document' }],
    ]);
    await expect(service.findAttachment('app-1', fileId, user)).resolves.toMatchObject({
      id: fileId,
    });
    const predicate = conditions.find((item) => item.table === files)!.condition;
    expect(new PgDialect().sqlToQuery(predicate).params).toEqual([
      fileId,
      'applicant',
      'private',
      'ready',
    ]);
  });

  it('denies a different business before looking up the file', async () => {
    const { service, db } = setup([[record()]]);
    await expect(service.findAttachment('app-1', fileId, 'stranger')).rejects.toThrow(
      NotFoundException,
    );
    expect(db.select).toHaveBeenCalledTimes(1);
  });
  it('denies files that were not submitted in this application', async () => {
    const { service, db } = setup([[record()], [{ id: 'app-1' }]]);
    await expect(service.findAttachment('app-1', 'other-file', 'owner')).rejects.toThrow(
      NotFoundException,
    );
    expect(db.select).toHaveBeenCalledTimes(2);
  });
  it('denies a missing, non-private, non-ready, or wrong-uploader file', async () => {
    const { service } = setup([[record()], [{ id: 'app-1' }], []]);
    await expect(service.findAttachment('app-1', fileId, 'owner')).rejects.toThrow(
      NotFoundException,
    );
  });
  it('does not expose answers or files to the business before payment, but allows the applicant', async () => {
    const unpaid = setup([[record(1000)], []]);
    await expect(unpaid.service.findById('app-1', 'owner')).rejects.toThrow(NotFoundException);
    const applicant = setup([[record(1000)]]);
    await expect(applicant.service.findById('app-1', 'applicant')).resolves.toHaveProperty(
      'formAnswers',
      [answer],
    );
    const paid = setup([
      [record(1000)],
      [{ id: 'paid-order' }],
      [{ id: fileId, key: 'private-document' }],
    ]);
    await expect(paid.service.findAttachment('app-1', fileId, 'owner')).resolves.toHaveProperty(
      'id',
      fileId,
    );
  });

  it('signs only the key returned by the authorized attachment lookup', async () => {
    const findAttachment = vi.fn().mockResolvedValue({ key: 'authorized-key' });
    const getPrivateReadUrl = vi.fn().mockResolvedValue('https://example.com/temporary');
    const controller = new ApplicationsController(
      { findAttachment } as never,
      { getPrivateReadUrl } as never,
    );
    await expect(controller.attachment('app-1', fileId, { id: 'owner' } as never)).resolves.toEqual(
      { url: 'https://example.com/temporary' },
    );
    expect(findAttachment).toHaveBeenCalledWith('app-1', fileId, 'owner');
    expect(getPrivateReadUrl).toHaveBeenCalledWith('authorized-key');
    expect(
      Reflect.getMetadata('__headers__', ApplicationsController.prototype.attachment),
    ).toContainEqual({ name: 'Cache-Control', value: 'private, no-store' });
    getPrivateReadUrl.mockClear();
    findAttachment.mockRejectedValue(new NotFoundException());
    await expect(
      controller.attachment('app-1', fileId, { id: 'stranger' } as never),
    ).rejects.toThrow(NotFoundException);
    expect(getPrivateReadUrl).not.toHaveBeenCalled();
  });
});
