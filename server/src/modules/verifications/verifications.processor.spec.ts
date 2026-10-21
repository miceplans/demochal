import { describe, expect, it, vi } from 'vitest';
import { createDbStub } from '../admin/admin.test-helpers.js';
import { VerificationsProcessorService } from './verifications.processor.js';

describe('VerificationsProcessorService', () => {
  it.each(['verified', 'rejected'])(
    'skips a verification that is already %s (redelivery / manual decision)',
    async (status) => {
      const { db } = createDbStub({ select: [[{ id: 'v1', businessId: 'b1', status }]] });
      const notifications = { create: vi.fn() };
      const processor = new VerificationsProcessorService(db, notifications as never);

      await processor.process({ verificationId: 'v1' } as never);

      expect(db.update).not.toHaveBeenCalled();
      expect(notifications.create).not.toHaveBeenCalled();
    },
  );
});
