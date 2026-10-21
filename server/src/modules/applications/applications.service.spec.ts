import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { applications, challenges, files, type ApplicationFormQuestion } from '../../db/schema.js';
import { PgDialect } from 'drizzle-orm/pg-core';
import { ApplicationsService } from './applications.service.js';
import type { ApplyChallengeDto } from './dto/apply-challenge.dto.js';
import type { UpdateApplicationDto } from './dto/update-application.dto.js';

/** Chainable drizzle stub matching apply(): select projections, insert().values().returning(), and transaction pass-through. */
function createDbStub(options: {
  challenge?: {
    id: string;
    price: number;
    title: string;
    status?: string;
    visibility?: string;
    startDate?: Date;
    endDate?: Date;
    applicationForm?: ApplicationFormQuestion[];
    recruitMethod?: string;
  };
  existingApplication?: Record<string, unknown>;
  latestOrder?: Record<string, unknown>;
  application?: Record<string, unknown>;
  order?: Record<string, unknown>;
  ownedFiles?: { id: string }[];
}) {
  const challenge = options.challenge && {
    status: 'published',
    startDate: new Date(Date.now() - 60_000),
    endDate: new Date(Date.now() + 60_000),
    ...options.challenge,
  };
  const limit = vi.fn();
  const selectFrom = vi.fn((table: unknown) => ({
    where: vi.fn((condition: any) => {
      if (table === files) {
        const query = new PgDialect().sqlToQuery(condition);
        expect(query.params).toContain('user-1');
        expect(query.params).toContain('private');
        expect(query.params).toContain('ready');
        return Promise.resolve(options.ownedFiles ?? []);
      }
      if (table === challenges) {
        limit.mockResolvedValue(challenge ? [challenge] : []);
        return { limit };
      }
      if (table === applications) {
        limit.mockResolvedValue(options.existingApplication ? [options.existingApplication] : []);
        return { limit };
      }
      // orders (latest lookup in orderForApplication)
      limit.mockResolvedValue(options.latestOrder ? [options.latestOrder] : []);
      return { orderBy: vi.fn(() => ({ limit })), limit };
    }),
  }));
  const select = vi.fn(() => ({ from: selectFrom }));

  const values = vi.fn();
  const insert = vi.fn((table: unknown) => ({
    values: vi.fn((body: unknown) => {
      values(body);
      return {
        returning: vi
          .fn()
          .mockResolvedValue(
            table === applications
              ? options.application
                ? [options.application]
                : []
              : options.order
                ? [options.order]
                : [],
          ),
      };
    }),
  }));

  const db: any = { select, insert, values };
  db.transaction = vi.fn((cb: (tx: unknown) => unknown) => cb(db));
  return db;
}

const dto: ApplyChallengeDto = { challengeId: 'challenge-1' };

describe('ApplicationsService.apply', () => {
  const fileId = '11111111-1111-4111-8111-111111111111';
  const applicationForm: ApplicationFormQuestion[] = [
    { id: 'q1', title: '지원 동기', type: 'short', options: [], required: true },
    { id: 'q2', title: '자료', type: 'file', options: [], required: true },
  ];
  it('persists verified private attachments and server-derived question snapshots', async () => {
    const db = createDbStub({
      challenge: { id: 'challenge-1', price: 0, title: 'Form', applicationForm },
      ownedFiles: [{ id: fileId }],
      application: { id: 'app-1' },
    });
    await new ApplicationsService(db, { create: vi.fn() } as never).apply(
      {
        ...dto,
        formAnswers: [
          { questionId: 'q1', value: '지원합니다' },
          { questionId: 'q2', value: fileId },
        ],
      },
      'user-1',
    );
    expect(db.values).toHaveBeenCalledWith(
      expect.objectContaining({
        formAnswers: [
          { questionId: 'q1', title: '지원 동기', type: 'short', value: '지원합니다' },
          { questionId: 'q2', title: '자료', type: 'file', value: fileId },
        ],
      }),
    );
  });
  it('rejects missing answers and unowned/non-ready/non-private attachments before creating an application or order', async () => {
    const db = createDbStub({
      challenge: { id: 'challenge-1', price: 1000, title: 'Form', applicationForm },
    });
    const service = new ApplicationsService(db, { create: vi.fn() } as never);
    await expect(service.apply(dto, 'user-1')).rejects.toThrow(BadRequestException);
    await expect(
      service.apply(
        {
          ...dto,
          formAnswers: [
            { questionId: 'q1', value: '지원합니다' },
            { questionId: 'q2', value: fileId },
          ],
        },
        'user-1',
      ),
    ).rejects.toThrow(BadRequestException);
    expect(db.insert).not.toHaveBeenCalled();
  });
  it('reports which attachment ids are invalid so the client can drop only those', async () => {
    const db = createDbStub({
      challenge: { id: 'challenge-1', price: 1000, title: 'Form', applicationForm },
    });
    const service = new ApplicationsService(db, { create: vi.fn() } as never);
    const error = await service
      .apply(
        {
          ...dto,
          formAnswers: [
            { questionId: 'q1', value: '지원합니다' },
            { questionId: 'q2', value: fileId },
          ],
        },
        'user-1',
      )
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as BadRequestException).getResponse()).toMatchObject({
      invalidFileIds: [fileId],
    });
  });
  it('keeps original answers on a retry even after the questionnaire changed', async () => {
    const original = [
      { questionId: 'old', title: 'Old question', type: 'short', value: 'Original' },
    ];
    const db = createDbStub({
      challenge: { id: 'challenge-1', price: 0, title: 'Form', applicationForm },
      existingApplication: { id: 'app-1', formAnswers: original },
    });
    const result = await new ApplicationsService(db, { create: vi.fn() } as never).apply(
      { ...dto, formAnswers: [{ questionId: 'unknown', value: 'Replacement' }] },
      'user-1',
    );
    expect(result.formAnswers).toEqual(original);
    expect(db.insert).not.toHaveBeenCalled();
  });
  it('returns the pending order info for a paid challenge', async () => {
    const db = createDbStub({
      challenge: { id: 'challenge-1', price: 10000, title: '유료 챌린지' },
      application: { id: 'app-1', challengeId: 'challenge-1', userId: 'user-1' },
      order: { id: 'order-1', amount: 10000 },
    });
    const service = new ApplicationsService(db, { create: vi.fn() } as never);

    const result = await service.apply(dto, 'user-1');

    expect(result.order).toEqual({ id: 'order-1', amount: 10000, name: '유료 챌린지' });
    expect(result.id).toBe('app-1');
  });

  it('returns a null order for a free challenge (price 0)', async () => {
    const db = createDbStub({
      challenge: { id: 'challenge-1', price: 0, title: 'Free Challenge' },
      application: { id: 'app-2', challengeId: 'challenge-1', userId: 'user-1' },
    });
    const service = new ApplicationsService(db, { create: vi.fn() } as never);

    const result = await service.apply(dto, 'user-1');

    expect(result.order).toBeNull();
  });

  it('fails when the paid order insert returns no row', async () => {
    const db = createDbStub({
      challenge: { id: 'challenge-1', price: 10000, title: '유료 챌린지' },
      application: { id: 'app-1', challengeId: 'challenge-1', userId: 'user-1' },
    });
    const service = new ApplicationsService(db, { create: vi.fn() } as never);

    await expect(service.apply(dto, 'user-1')).rejects.toThrow('Failed to create order');
  });

  it('throws NotFoundException for a missing challenge', async () => {
    const db = createDbStub({});
    const service = new ApplicationsService(db, { create: vi.fn() } as never);

    await expect(service.apply(dto, 'user-1')).rejects.toThrow(NotFoundException);
  });

  it.each([
    ['draft', { status: 'draft' }],
    ['closed', { status: 'closed' }],
    ['not yet open', { startDate: new Date(Date.now() + 60_000) }],
    ['expired', { endDate: new Date(Date.now() - 60_000) }],
  ])('rejects a %s challenge before creating an application or order', async (_label, patch) => {
    const db = createDbStub({
      challenge: { id: 'challenge-1', price: 10000, title: 'unavailable', ...patch },
    });
    const service = new ApplicationsService(db, { create: vi.fn() } as never);

    await expect(service.apply(dto, 'user-1')).rejects.toThrow(BadRequestException);
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('rejects applying to an external-recruit challenge before creating rows', async () => {
    const db = createDbStub({
      challenge: { id: 'challenge-1', price: 0, title: 'Ext', recruitMethod: 'external' },
    });
    await expect(
      new ApplicationsService(db, { create: vi.fn() } as never).apply(dto, 'user-1'),
    ).rejects.toThrow('외부 접수 챌린지');
    expect(db.values).not.toHaveBeenCalled();
  });

  it('notifies the applicant in the same transaction for a free application', async () => {
    const db = createDbStub({
      challenge: { id: 'challenge-1', price: 0, title: 'Free' },
      application: { id: 'app-1' },
    });
    const notifications = { create: vi.fn() };
    await new ApplicationsService(db, notifications as never).apply(dto, 'user-1');
    expect(notifications.create).toHaveBeenCalledWith(
      'user-1',
      'application.submitted',
      { applicationId: 'app-1', challengeId: 'challenge-1', challengeTitle: 'Free' },
      db,
    );
  });

  it('defers the notification until payment for a paid application', async () => {
    const db = createDbStub({
      challenge: { id: 'challenge-1', price: 1000, title: 'Paid' },
      application: { id: 'app-1' },
      order: { id: 'order-1' },
    });
    const notifications = { create: vi.fn() };
    await new ApplicationsService(db, notifications as never).apply(dto, 'user-1');
    expect(notifications.create).not.toHaveBeenCalled();
  });

  it('rejects a private challenge before creating an application or order', async () => {
    const db = createDbStub({
      challenge: { id: 'challenge-1', price: 10000, title: 'private', visibility: 'private' },
    });
    const service = new ApplicationsService(db, { create: vi.fn() } as never);

    await expect(service.apply(dto, 'user-1')).rejects.toThrow(BadRequestException);
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('does not reuse or replace an existing application order after it becomes private', async () => {
    const db = createDbStub({
      challenge: { id: 'challenge-1', price: 10000, title: 'private', visibility: 'private' },
      existingApplication: { id: 'app-1', challengeId: 'challenge-1', userId: 'user-1' },
      latestOrder: { id: 'old-order', amount: 10000, status: 'canceled' },
    });
    const service = new ApplicationsService(db, { create: vi.fn() } as never);

    await expect(service.apply(dto, 'user-1')).rejects.toThrow(BadRequestException);
    expect(db.insert).not.toHaveBeenCalled();
  });

  it.each([
    ['closed', { status: 'closed' }],
    ['expired', { endDate: new Date(Date.now() - 60_000) }],
  ])(
    'still reuses the existing application and pending order after the challenge is %s',
    async (_label, patch) => {
      const db = createDbStub({
        challenge: { id: 'challenge-1', price: 10000, title: '유료 챌린지', ...patch },
        existingApplication: { id: 'app-1', challengeId: 'challenge-1', userId: 'user-1' },
        latestOrder: { id: 'order-1', amount: 10000, status: 'pending' },
      });
      const service = new ApplicationsService(db, { create: vi.fn() } as never);

      const result = await service.apply(dto, 'user-1');

      expect(result.id).toBe('app-1');
      expect(result.order).toEqual({ id: 'order-1', amount: 10000, name: '유료 챌린지' });
      expect(db.insert).not.toHaveBeenCalled();
    },
  );

  it('truncates the Toss orderName to the 100-character limit', async () => {
    const longTitle = '해'.repeat(150);
    const db = createDbStub({
      challenge: { id: 'challenge-1', price: 10000, title: longTitle },
      application: { id: 'app-1', challengeId: 'challenge-1', userId: 'user-1' },
      order: { id: 'order-1', amount: 10000 },
    });
    const service = new ApplicationsService(db, { create: vi.fn() } as never);

    const result = await service.apply(dto, 'user-1');

    expect(result.order?.name).toHaveLength(100);
    expect(result.order?.name.endsWith('…')).toBe(true);
  });

  it('reuses the existing application and its pending order on retry instead of inserting duplicates', async () => {
    const db = createDbStub({
      challenge: { id: 'challenge-1', price: 10000, title: '유료 챌린지' },
      existingApplication: { id: 'app-1', challengeId: 'challenge-1', userId: 'user-1' },
      latestOrder: { id: 'order-1', amount: 10000, status: 'pending' },
    });
    const service = new ApplicationsService(db, { create: vi.fn() } as never);

    const result = await service.apply(dto, 'user-1');

    expect(result.id).toBe('app-1');
    expect(result.order).toEqual({ id: 'order-1', amount: 10000, name: '유료 챌린지' });
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('creates a replacement pending order when the previous order reached a terminal unpaid state', async () => {
    const db = createDbStub({
      challenge: { id: 'challenge-1', price: 10000, title: '유료 챌린지' },
      existingApplication: { id: 'app-1', challengeId: 'challenge-1', userId: 'user-1' },
      latestOrder: { id: 'order-1', amount: 10000, status: 'canceled' },
      order: { id: 'order-2', amount: 10000 },
    });
    const service = new ApplicationsService(db, { create: vi.fn() } as never);

    const result = await service.apply(dto, 'user-1');

    expect(result.order?.id).toBe('order-2');
  });

  it('returns a null order for an existing application whose order is already paid', async () => {
    const db = createDbStub({
      challenge: { id: 'challenge-1', price: 10000, title: '유료 챌린지' },
      existingApplication: { id: 'app-1', challengeId: 'challenge-1', userId: 'user-1' },
      latestOrder: { id: 'order-1', amount: 10000, status: 'paid' },
    });
    const service = new ApplicationsService(db, { create: vi.fn() } as never);

    const result = await service.apply(dto, 'user-1');

    expect(result.id).toBe('app-1');
    expect(result.order).toBeNull();
  });
});

describe('ApplicationsService.listForUser', () => {
  it('joins the challenge title and business name onto each application', async () => {
    const rows = [
      {
        application: {
          id: 'app-1',
          challengeId: 'challenge-1',
          userId: 'user-1',
          status: 'pending',
        },
        challengeTitle: '2026 AI 챌린지',
        businessName: '한국데이터산업진흥원',
      },
    ];
    const limit = vi.fn().mockResolvedValue(rows);
    const orderBy = vi.fn().mockResolvedValue(rows);
    const whereResult = Object.assign(Promise.resolve(rows), { limit, orderBy });
    const joinTarget: { innerJoin: unknown; where: unknown } = {
      innerJoin: undefined,
      where: undefined,
    };
    joinTarget.innerJoin = vi.fn().mockReturnValue(joinTarget);
    joinTarget.where = vi.fn().mockReturnValue(whereResult);
    const db: any = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({ innerJoin: joinTarget.innerJoin }),
      }),
    };
    const service = new ApplicationsService(db, { create: vi.fn() } as never);

    const result = await service.listForUser('user-1');

    expect(result).toEqual([
      {
        id: 'app-1',
        challengeId: 'challenge-1',
        userId: 'user-1',
        status: 'pending',
        challengeTitle: '2026 AI 챌린지',
        businessName: '한국데이터산업진흥원',
      },
    ]);
  });
});

/** Stub matching update(): findWithBusinessOwner (applications→innerJoin→innerJoin→where→limit),
 * the file-ownership select on files, and update().set().where().returning() capture. */
function createUpdateDbStub(options: {
  row?: {
    application: Record<string, unknown>;
    businessOwnerId: string;
    price: number;
    applicationForm?: ApplicationFormQuestion[] | null;
  };
  updated?: Record<string, unknown>;
  ownedFiles?: { id: string }[];
}) {
  const updateSet = vi.fn();
  const update = vi.fn(() => ({
    set: vi.fn((body: unknown) => {
      updateSet(body);
      return {
        where: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue(options.updated ? [options.updated] : []),
        })),
      };
    }),
  }));
  const limit = vi.fn().mockResolvedValue(options.row ? [options.row] : []);
  const fromChain: {
    innerJoin: ReturnType<typeof vi.fn>;
    where: ReturnType<typeof vi.fn>;
  } = {
    innerJoin: vi.fn(),
    where: vi.fn(() => ({ limit })),
  };
  fromChain.innerJoin.mockReturnValue(fromChain);
  const selectFrom = vi.fn((table: unknown) => {
    if (table === files) {
      return {
        where: vi.fn((condition: any) => {
          const query = new PgDialect().sqlToQuery(condition);
          expect(query.params).toContain('user-1');
          expect(query.params).toContain('private');
          expect(query.params).toContain('ready');
          return Promise.resolve(options.ownedFiles ?? []);
        }),
      };
    }
    return fromChain;
  });
  const db: any = {
    select: vi.fn(() => ({ from: selectFrom })),
    update,
    updateSet,
  };
  return db;
}

describe('ApplicationsService.update', () => {
  const fileId = '11111111-1111-4111-8111-111111111111';
  const applicationForm: ApplicationFormQuestion[] = [
    { id: 'q1', title: '지원 동기', type: 'short', options: [], required: true },
    { id: 'q2', title: '자료', type: 'file', options: [], required: true },
  ];
  const applicantRow = (status = 'pending') => ({
    application: { id: 'app-1', userId: 'user-1', status, formAnswers: [] },
    businessOwnerId: 'owner-1',
    price: 0,
    applicationForm,
  });
  const serviceWith = (db: any) => new ApplicationsService(db, { create: vi.fn() } as never);

  it('지원자 본인이 역할/팀원/답변을 수정하면 반영된다', async () => {
    const db = createUpdateDbStub({
      row: applicantRow(),
      ownedFiles: [{ id: fileId }],
      updated: { id: 'app-1', role: '백엔드' },
    });
    const result = await serviceWith(db).update(
      'app-1',
      {
        role: '백엔드',
        teammates: ['홍길동'],
        formAnswers: [
          { questionId: 'q1', value: '지원합니다' },
          { questionId: 'q2', value: fileId },
        ],
      },
      'user-1',
    );
    expect(db.updateSet).toHaveBeenCalledWith({
      role: '백엔드',
      teammates: ['홍길동'],
      formAnswers: [
        { questionId: 'q1', title: '지원 동기', type: 'short', value: '지원합니다' },
        { questionId: 'q2', title: '자료', type: 'file', value: fileId },
      ],
    });
    expect(result).toEqual({ id: 'app-1', role: '백엔드' });
  });

  it('지원자 본인이 role: null로 저장된 역할을 지운다', async () => {
    const db = createUpdateDbStub({ row: applicantRow(), updated: { id: 'app-1', role: null } });
    await serviceWith(db).update('app-1', { role: null }, 'user-1');
    expect(db.updateSet).toHaveBeenCalledWith({ role: null });
  });

  it('지원자 본인 요청의 심사 필드(status/evaluation/managerMemo)는 적용되지 않는다', async () => {
    const db = createUpdateDbStub({ row: applicantRow(), updated: { id: 'app-1' } });
    await serviceWith(db).update(
      'app-1',
      { role: '기획자', status: 'accepted', evaluation: 'pass', managerMemo: '메모' },
      'user-1',
    );
    expect(db.updateSet).toHaveBeenCalledWith({ role: '기획자' });
  });

  it.each([
    ['reviewing', 'reviewing'],
    ['accepted', 'accepted'],
    ['rejected', 'rejected'],
  ])('상태가 %s인 지원서는 지원자 본인이 수정하면 409를 던진다', async (_label, status) => {
    const db = createUpdateDbStub({ row: applicantRow(status) });
    await expect(serviceWith(db).update('app-1', { role: '백엔드' }, 'user-1')).rejects.toThrow(
      ConflictException,
    );
    expect(db.update).not.toHaveBeenCalled();
  });

  it('needs_revision 상태는 지원자 본인이 수정할 수 있다', async () => {
    const db = createUpdateDbStub({
      row: applicantRow('needs_revision'),
      updated: { id: 'app-1' },
    });
    await serviceWith(db).update('app-1', { role: '백엔드' }, 'user-1');
    expect(db.updateSet).toHaveBeenCalledWith({ role: '백엔드' });
  });

  it('타인의 지원서는 404다', async () => {
    const db = createUpdateDbStub({ row: applicantRow() });
    await expect(serviceWith(db).update('app-1', { role: '백엔드' }, 'stranger')).rejects.toThrow(
      NotFoundException,
    );
    expect(db.update).not.toHaveBeenCalled();
  });

  it('사업주는 심사 필드만 반영하고 내용 필드(role/teammates/formAnswers)는 무시한다', async () => {
    const db = createUpdateDbStub({ row: applicantRow(), updated: { id: 'app-1' } });
    const dto: UpdateApplicationDto = {
      status: 'reviewing',
      evaluation: 'pass',
      managerMemo: '메모',
      role: '백엔드',
      teammates: ['홍길동'],
      // 사업주 분기에서 검증하지 않아야 해서 일부러 유효하지 않은 질문 ID를 담는다.
      formAnswers: [{ questionId: 'unknown', value: 'x' }],
    };
    await serviceWith(db).update('app-1', dto, 'owner-1');
    expect(db.updateSet).toHaveBeenCalledWith({
      status: 'reviewing',
      evaluation: 'pass',
      managerMemo: '메모',
    });
  });

  it('지원자 본인 수정 시 본인 소유가 아닌 파일 답변은 거부한다', async () => {
    const db = createUpdateDbStub({ row: applicantRow(), ownedFiles: [] });
    await expect(
      serviceWith(db).update(
        'app-1',
        {
          formAnswers: [
            { questionId: 'q1', value: '지원합니다' },
            { questionId: 'q2', value: fileId },
          ],
        },
        'user-1',
      ),
    ).rejects.toThrow(BadRequestException);
    expect(db.update).not.toHaveBeenCalled();
  });

  it('지원자 본인 수정 시 저장된 질문에 없는 답변은 거부한다', async () => {
    const db = createUpdateDbStub({ row: applicantRow() });
    await expect(
      serviceWith(db).update(
        'app-1',
        { formAnswers: [{ questionId: 'unknown', value: 'x' }] },
        'user-1',
      ),
    ).rejects.toThrow(BadRequestException);
    expect(db.update).not.toHaveBeenCalled();
  });
});
