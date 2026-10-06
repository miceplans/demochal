import { describe, expect, it } from 'vitest';
import { resolveThreadId, safeHeader } from './email.types.js';

describe('email thread and reply helpers', () => {
  it('prefers In-Reply-To/References over normalized subject fallback', () => {
    expect(
      resolveThreadId(
        { inReplyTo: '<root@example.com>', references: [] },
        [{ messageId: '<root@example.com>', threadId: 'header-thread' }],
      ),
    ).toBe('header-thread');
  });

  it('does not merge a message when reply headers do not match', () => {
    expect(
      resolveThreadId(
        { references: [] },
        [],
      ),
    ).toBeUndefined();
  });

  it('removes line breaks from header values and preserves reply headers', () => {
    expect(safeHeader('customer@example.com\r\nBcc: attacker@example.com')).toBe(
      'customer@example.com Bcc: attacker@example.com',
    );
  });
});
