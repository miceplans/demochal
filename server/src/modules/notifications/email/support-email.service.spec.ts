import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emailMessages } from '../../../db/schema.js';
import { SupportEmailService } from './support-email.service.js';

const claim = vi.hoisted(() => ({
  claimEmailSend: vi.fn(),
  markEmailSent: vi.fn(),
  releaseEmailSendClaim: vi.fn(),
}));
vi.mock('./email-send-claim.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./email-send-claim.js')>()),
  ...claim,
}));

const job = { eventId: 'evt-1', payload: { emailMessageId: 'msg-row-1' } };
const row = {
  id: 'msg-row-1',
  deliveryStatus: 'QUEUED',
  toAddresses: ['customer@example.com'],
  messageId: 'out-1@semochall.com',
  inReplyTo: 'customer-1@example.com',
  references: 'root@example.com customer-1@example.com',
  subject: 'Re: 문의',
  textBody: '답변 <b>',
  htmlBody: null,
};

describe('SupportEmailService.process', () => {
  let rows: unknown[];
  let updateSet: ReturnType<typeof vi.fn>;
  let db: Record<string, ReturnType<typeof vi.fn>>;
  let ses: { isConfigured: ReturnType<typeof vi.fn>; sendSupportEmail: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    rows = [row];
    updateSet = vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) }));
    db = {
      select: vi.fn(() => ({
        from: () => ({ where: () => ({ limit: () => Promise.resolve(rows) }) }),
      })),
      update: vi.fn(() => ({ set: updateSet })),
    };
    ses = {
      isConfigured: vi.fn(() => true),
      sendSupportEmail: vi.fn().mockResolvedValue({ sesMessageId: 'ses-1' }),
    };
    claim.claimEmailSend.mockResolvedValue('claimed');
    claim.releaseEmailSendClaim.mockResolvedValue(true);
  });

  const service = () => new SupportEmailService(db as never, ses as never);

  it('sends the stored message with threading headers and marks it SENT', async () => {
    await expect(service().process(job)).resolves.toBe('sent');

    expect(ses.sendSupportEmail).toHaveBeenCalledWith({
      to: 'customer@example.com',
      subject: 'Re: 문의',
      text: '답변 <b>',
      html: '<pre>답변 &lt;b&gt;</pre>',
      messageId: '<out-1@semochall.com>',
      inReplyTo: '<customer-1@example.com>',
      references: '<root@example.com> <customer-1@example.com>',
    });
    expect(db.update).toHaveBeenCalledWith(emailMessages);
    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ deliveryStatus: 'SENT', sesMessageId: 'ses-1' }),
    );
    expect(claim.markEmailSent).toHaveBeenCalledWith(db, 'evt-1');
  });

  it('throws without calling SES when the support sender is not configured', async () => {
    ses.isConfigured.mockReturnValue(false);
    await expect(service().process(job)).rejects.toThrow('not configured');
    expect(ses.sendSupportEmail).not.toHaveBeenCalled();
  });

  it('acks a missing message row and an already SENT message without sending', async () => {
    rows = [];
    await expect(service().process(job)).resolves.toBe('message_missing');
    rows = [{ ...row, deliveryStatus: 'SENT' }];
    await expect(service().process(job)).resolves.toBe('already_sent');
    expect(ses.sendSupportEmail).not.toHaveBeenCalled();
  });

  it('does not send when another delivery already sent or holds the claim', async () => {
    claim.claimEmailSend.mockResolvedValueOnce('sent');
    await expect(service().process(job)).resolves.toBe('already_sent');
    claim.claimEmailSend.mockResolvedValueOnce('in_flight');
    await expect(service().process(job)).rejects.toMatchObject({ name: 'EmailSendInFlightError' });
    expect(ses.sendSupportEmail).not.toHaveBeenCalled();
  });

  it('releases the claim and rethrows when SES fails, leaving the row QUEUED', async () => {
    ses.sendSupportEmail.mockRejectedValue(new Error('rejected customer@example.com'));
    await expect(service().process(job)).rejects.toThrow();
    expect(claim.releaseEmailSendClaim).toHaveBeenCalledWith(db, 'evt-1');
    expect(db.update).not.toHaveBeenCalled();
    expect(claim.markEmailSent).not.toHaveBeenCalled();
  });
});
