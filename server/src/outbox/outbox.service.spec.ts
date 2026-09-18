import { describe, expect, it, vi } from 'vitest';
import { OutboxService } from './outbox.service.js';

describe('OutboxService.enqueue', () => {
  it('inserts a row on the given transaction handle', async () => {
    const values = vi.fn().mockResolvedValue(undefined);
    const insert = vi.fn().mockReturnValue({ values });
    const tx: any = { insert };
    const service = new OutboxService();

    await service.enqueue(tx, 'verification.submitted', { verificationId: 'verif-1' });

    expect(insert).toHaveBeenCalled();
    expect(values).toHaveBeenCalledWith({
      eventType: 'verification.submitted',
      payload: { verificationId: 'verif-1' },
    });
  });
});
