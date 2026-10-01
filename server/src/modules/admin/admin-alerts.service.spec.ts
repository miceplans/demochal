import { describe, expect, it, vi } from 'vitest';
import { AdminAlertsService } from './admin-alerts.service.js';

function setup(options: { enabled?: boolean; admins?: { id: string }[]; selectError?: Error }) {
  const db: any = {
    select: vi.fn(() => ({
      from: () => ({
        where: () =>
          options.selectError
            ? Promise.reject(options.selectError)
            : Promise.resolve(options.admins ?? []),
      }),
    })),
  };
  const settings = { isEnabled: vi.fn().mockResolvedValue(options.enabled ?? true) };
  const notifications = { create: vi.fn().mockResolvedValue(null) };
  const service = new AdminAlertsService(db, settings as any, notifications as any);
  return { service, db, settings, notifications };
}

describe('AdminAlertsService', () => {
  it('notifies every active admin when the switch is on', async () => {
    const { service, settings, notifications } = setup({ admins: [{ id: 'a1' }, { id: 'a2' }] });

    await service.notify('reportAlert', 'admin.report', { reportId: 'r1' });

    expect(settings.isEnabled).toHaveBeenCalledWith('reportAlert');
    expect(notifications.create).toHaveBeenCalledTimes(2);
    expect(notifications.create).toHaveBeenCalledWith('a1', 'admin.report', { reportId: 'r1' });
    expect(notifications.create).toHaveBeenCalledWith('a2', 'admin.report', { reportId: 'r1' });
  });

  it('does nothing when the switch is off (no admin lookup, no notifications)', async () => {
    const { service, db, notifications } = setup({ enabled: false, admins: [{ id: 'a1' }] });

    await service.notify('newBusinessAlert', 'admin.business', { businessId: 'b1' });

    expect(db.select).not.toHaveBeenCalled();
    expect(notifications.create).not.toHaveBeenCalled();
  });

  it('swallows failures so the originating request is not broken', async () => {
    const { service, notifications } = setup({ selectError: new Error('db down') });

    await expect(service.notify('reportAlert', 'admin.report', {})).resolves.toBeUndefined();
    expect(notifications.create).not.toHaveBeenCalled();
  });
});
