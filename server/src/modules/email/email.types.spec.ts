import { describe, expect, it } from 'vitest';
import { decodeMimeWords, extractAddress, resolveThreadId, safeHeader } from './email.types.js';

describe('email thread and reply helpers', () => {
  it('prefers In-Reply-To/References over normalized subject fallback', () => {
    expect(
      resolveThreadId({ inReplyTo: '<root@example.com>', references: [] }, [
        { messageId: '<root@example.com>', threadId: 'header-thread' },
      ]),
    ).toBe('header-thread');
  });

  it('does not merge a message when reply headers do not match', () => {
    expect(resolveThreadId({ references: [] }, [])).toBeUndefined();
  });

  it('removes line breaks from header values and preserves reply headers', () => {
    expect(safeHeader('customer@example.com\r\nBcc: attacker@example.com')).toBe(
      'customer@example.com Bcc: attacker@example.com',
    );
  });
});

describe('decodeMimeWords', () => {
  it('decodes adjacent base64 encoded-words and keeps the address', () => {
    expect(decodeMimeWords('=?UTF-8?B?7KKA67mE65287J207ZSE?==?UTF-8?B?7Zmp7KeA7JiB?=')).toBe(
      '좀비라이프황지영',
    );
    expect(decodeMimeWords('=?UTF-8?B?7Zmp7KeA7JiB?= <a@b.com>')).toBe('황지영 <a@b.com>');
  });
  it('keeps malformed encoded-words as-is', () => {
    expect(decodeMimeWords('=?UTF-8?B?!!!?=')).toBe('=?UTF-8?B?!!!?=');
  });
  it('decodes Q encoding and passes plain text through', () => {
    expect(decodeMimeWords('=?UTF-8?Q?=ED=99=A9?=')).toBe('황');
    expect(decodeMimeWords('plain subject')).toBe('plain subject');
  });
});

describe('extractAddress', () => {
  it('extracts addr-spec from a display-name address', () => {
    expect(extractAddress('황지영 <a@b.com>')).toBe('a@b.com');
    expect(extractAddress(' a@b.com ')).toBe('a@b.com');
  });
});
