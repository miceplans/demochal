import { describe, expect, it, vi } from 'vitest';
import { OperationsService } from './operations.service.js';

/** insert().values().returning() chain. */
function createDbStub(created: { id: string }) {
  const returning = vi.fn().mockResolvedValue([created]);
  const values = vi.fn().mockReturnValue({ returning });
  const insert = vi.fn(() => ({ values }));
  const db: any = { insert };
  return { db, values };
}

describe('OperationsService', () => {
  it('inserts the inquiry and returns { id, received: true }', async () => {
    const { db, values } = createDbStub({ id: 'inq-1' });
    const service = new OperationsService(db);

    const result = await service.createInquiry({
      name: '홍길동',
      contact: '010-1234-5678',
      content: '행사 운영대행 견적 문의',
    });

    expect(values).toHaveBeenCalledWith({
      name: '홍길동',
      contact: '010-1234-5678',
      content: '행사 운영대행 견적 문의',
    });
    expect(result).toEqual({ id: 'inq-1', received: true });
  });
});
