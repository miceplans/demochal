import { describe, expect, it } from 'vitest';
import { buildRawReply, resolveThreadId, safeHeader } from './email.types.js';

describe('email thread and reply helpers', () => {
  it('prefers In-Reply-To/References over normalized subject fallback', () => {
    expect(
      resolveThreadId(
        { inReplyTo: '<root@example.com>', references: [], subject: 'Re: 같은 제목' },
        [{ messageId: '<root@example.com>', threadId: 'header-thread' }],
        [{ id: 'subject-thread', subject: '같은 제목' }],
      ),
    ).toBe('header-thread');
  });

  it('falls back to a normalized subject only when no header matches', () => {
    expect(
      resolveThreadId(
        { references: [], subject: ' FWD: 문의  제목 ' },
        [],
        [{ id: 'subject-thread', subject: '문의 제목' }],
      ),
    ).toBe('subject-thread');
  });

  it('removes line breaks from header values and preserves reply headers', () => {
    expect(safeHeader('customer@example.com\r\nBcc: attacker@example.com')).toBe(
      'customer@example.com Bcc: attacker@example.com',
    );
    const raw = buildRawReply({
      to: 'customer@example.com',
      subject: 'Re: 문의',
      text: '답변',
      inReplyTo: 'root@example.com',
      references: ['root@example.com'],
      messageId: 'reply@example.com',
    });
    expect(raw).toContain('From: help@semochall.com');
    expect(raw).toContain('In-Reply-To: <root@example.com>');
    expect(raw).toContain('References: <root@example.com>');
  });
});
