import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from '../../../config/env.js';
import { emailMessages } from '../../../db/schema.js';
import { SupportEmailService } from './support-email.service.js';

describe('SupportEmailService', () => {
  const originalFrom = env.sesSupportFromEmail;
  let insertValues: ReturnType<typeof vi.fn>;
  let db: { insert: ReturnType<typeof vi.fn> };
  let ses: { isConfigured: ReturnType<typeof vi.fn>; sendSupportEmail: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    env.sesSupportFromEmail = 'help@semochall.com';
    insertValues = vi.fn().mockResolvedValue(undefined);
    db = { insert: vi.fn(() => ({ values: insertValues })) };
    ses = {
      isConfigured: vi.fn(() => true),
      sendSupportEmail: vi.fn().mockResolvedValue({ sesMessageId: 'ses-1' }),
    };
  });

  it('sends a threaded reply and records the accepted outbound message', async () => {
    const result = await new SupportEmailService(db as never, ses as never).sendSupportEmail({
      threadId: 'thread-1',
      to: 'customer@example.com',
      subject: 'Re: 문의',
      text: '답변',
      html: '<p>답변</p>',
      inReplyTo: '<customer-1@example.com>',
      references: '<customer-1@example.com>',
    });

    expect(result).toMatchObject({ sesMessageId: 'ses-1' });
    expect(ses.sendSupportEmail).toHaveBeenCalledWith({
      to: 'customer@example.com',
      subject: 'Re: 문의',
      text: '답변',
      html: '<p>답변</p>',
      messageId: expect.stringMatching(/^<.+@semochall\.com>$/),
      inReplyTo: '<customer-1@example.com>',
      references: '<customer-1@example.com>',
    });
    expect(db.insert).toHaveBeenCalledWith(emailMessages);
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        threadId: 'thread-1',
        direction: 'OUTBOUND',
        fromAddress: 'help@semochall.com',
        sesMessageId: 'ses-1',
        inReplyTo: '<customer-1@example.com>',
        references: '<customer-1@example.com>',
        deliveryStatus: 'SENT',
      }),
    );
  });

  it('does not call SES when support sending is not configured', async () => {
    env.sesSupportFromEmail = '';
    const service = new SupportEmailService(
      db as never,
      {
        ...ses,
        isConfigured: vi.fn(() => false),
      } as never,
    );

    await expect(
      service.sendSupportEmail({
        threadId: 'thread-1',
        to: 'customer@example.com',
        subject: 's',
        text: 't',
        html: 'h',
      }),
    ).rejects.toThrow('Support email sender is not configured');
    expect(ses.sendSupportEmail).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
  });

  afterEach(() => {
    env.sesSupportFromEmail = originalFrom;
  });
});
