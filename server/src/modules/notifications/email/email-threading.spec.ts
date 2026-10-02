import { describe, expect, it } from 'vitest';
import { threadLookupKeys } from './email-threading.js';

describe('threadLookupKeys', () => {
  it('prioritizes In-Reply-To and then References', () => {
    expect(
      threadLookupKeys({
        inReplyTo: '<reply@example.com>',
        references: '<root@example.com> <reply@example.com>',
        subject: 'Re: 문의',
      }),
    ).toEqual(['<reply@example.com>', '<root@example.com>']);
  });

  it('uses normalized subject only when no threading headers exist', () => {
    expect(threadLookupKeys({ subject: ' Re: Fwd: 문의 ' })).toEqual(['문의']);
  });

  it('does not fall back to subject when reply headers are present', () => {
    expect(threadLookupKeys({ inReplyTo: '<missing@example.com>', subject: '문의' })).toEqual([
      '<missing@example.com>',
    ]);
  });
});
