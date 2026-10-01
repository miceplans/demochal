import { describe, expect, it } from 'vitest';
import { NotificationsStreamService } from './notifications-stream.service.js';

const payload = (userId: string, notificationId: string) =>
  JSON.stringify({ userId, notificationId });

describe('NotificationsStreamService', () => {
  it('delivers events only to the matching user stream', () => {
    const service = new NotificationsStreamService();
    const received: unknown[] = [];
    const other: unknown[] = [];
    const sub = service.streamFor('user-1').subscribe((m) => received.push(m));
    const otherSub = service.streamFor('user-2').subscribe((m) => other.push(m));

    service.handleRaw(payload('user-1', 'n-1'));

    expect(received).toEqual([{ type: 'notification', data: { notificationId: 'n-1' } }]);
    expect(other).toEqual([]);
    sub.unsubscribe();
    otherSub.unsubscribe();
  });

  it('ignores malformed payloads', () => {
    const service = new NotificationsStreamService();
    const received: unknown[] = [];
    const sub = service.streamFor('user-1').subscribe((m) => received.push(m));

    service.handleRaw(undefined);
    service.handleRaw('not json');
    service.handleRaw(JSON.stringify({ userId: 1 }));

    expect(received).toEqual([]);
    sub.unsubscribe();
  });

  it('stops delivering after unsubscribe', () => {
    const service = new NotificationsStreamService();
    const received: unknown[] = [];
    service
      .streamFor('user-1')
      .subscribe((m) => received.push(m))
      .unsubscribe();

    service.handleRaw(payload('user-1', 'n-1'));

    expect(received).toEqual([]);
  });
});
