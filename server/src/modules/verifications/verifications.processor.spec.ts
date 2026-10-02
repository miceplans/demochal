import { describe, expect, it, vi } from 'vitest';
import { createDbStub } from '../admin/admin.test-helpers.js';
import { VerificationsProcessorService } from './verifications.processor.js';

describe('VerificationsProcessorService', () => {
  it.each(['verified', 'rejected'])(
    'skips a verification that is already %s (redelivery / manual decision)',
    async (status) => {
      const { db } = createDbStub({ select: [[{ id: 'v1', businessId: 'b1', status }]] });
      const notifications = { create: vi.fn() };
      const settings = { isEnabled: vi.fn().mockResolvedValue(true) };
      const processor = new VerificationsProcessorService(
        db,
        {} as never,
        {} as never,
        notifications as never,
        settings as never,
        {} as never,
      );

      await processor.process({ verificationId: 'v1' } as never);

      expect(db.update).not.toHaveBeenCalled();
      expect(notifications.create).not.toHaveBeenCalled();
      expect(settings.isEnabled).not.toHaveBeenCalled();
    },
  );
});
