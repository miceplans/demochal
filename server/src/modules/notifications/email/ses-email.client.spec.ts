import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { env } from '../../../config/env.js';
import { SesEmailClient } from './ses-email.client.js';

describe('SesEmailClient', () => {
  const originalFrom = env.sesFromEmail;
  const originalSupportFrom = env.sesSupportFromEmail;

  afterEach(() => {
    env.sesFromEmail = originalFrom;
    env.sesSupportFromEmail = originalSupportFrom;
    vi.restoreAllMocks();
  });

  it('reports configuration from SES_FROM_EMAIL', () => {
    env.sesFromEmail = '';
    expect(new SesEmailClient().isConfigured()).toBe(false);
    env.sesFromEmail = 'noreply@semochall.com';
    expect(new SesEmailClient().isConfigured()).toBe(true);
  });

  it('sends a SESv2 simple email with UTF-8 text and html bodies', async () => {
    env.sesFromEmail = 'noreply@semochall.com';
    const send = vi.spyOn(SESv2Client.prototype, 'send').mockResolvedValue({} as never);

    await new SesEmailClient().send({
      to: 'owner@example.com',
      subject: '[세모챌] 제목',
      text: '본문',
      html: '<p>본문</p>',
    });

    const command = send.mock.calls[0]?.[0] as SendEmailCommand;
    expect(command).toBeInstanceOf(SendEmailCommand);
    expect(command.input).toEqual({
      FromEmailAddress: 'noreply@semochall.com',
      Destination: { ToAddresses: ['owner@example.com'] },
      Content: {
        Simple: {
          Subject: { Data: '[세모챌] 제목', Charset: 'UTF-8' },
          Body: {
            Text: { Data: '본문', Charset: 'UTF-8' },
            Html: { Data: '<p>본문</p>', Charset: 'UTF-8' },
          },
        },
      },
    });
  });

  it('propagates SES errors to the caller', async () => {
    env.sesFromEmail = 'noreply@semochall.com';
    vi.spyOn(SESv2Client.prototype, 'send').mockRejectedValue(new Error('Throttling'));

    await expect(
      new SesEmailClient().send({ to: 'a@b.c', subject: 's', text: 't', html: 'h' }),
    ).rejects.toThrow('Throttling');
  });

  it('sends support replies from help with threading headers', async () => {
    env.sesSupportFromEmail = 'help@semochall.com';
    const send = vi
      .spyOn(SESv2Client.prototype, 'send')
      .mockResolvedValue({ MessageId: 'ses-1' } as never);

    await expect(
      new SesEmailClient().sendSupportEmail({
        to: 'customer@example.com',
        subject: 'Re: 문의',
        text: '답변',
        html: '<p>답변</p>',
        messageId: '<reply-1@semochall.com>',
        inReplyTo: '<customer-1@example.com>',
        references: '<customer-1@example.com>',
      }),
    ).resolves.toEqual({ sesMessageId: 'ses-1' });

    const command = send.mock.calls[0]?.[0] as SendEmailCommand;
    expect(command.input.FromEmailAddress).toBe('help@semochall.com');
    expect(command.input.Content?.Simple?.Headers).toEqual([
      { Name: 'Message-ID', Value: '<reply-1@semochall.com>' },
      { Name: 'In-Reply-To', Value: '<customer-1@example.com>' },
      { Name: 'References', Value: '<customer-1@example.com>' },
    ]);
  });

  it('does not send support mail when help is not configured', async () => {
    env.sesSupportFromEmail = '';
    const client = new SesEmailClient();
    await expect(
      client.sendSupportEmail({ to: 'customer@example.com', subject: 's', text: 't', html: 'h' }),
    ).rejects.toThrow('Support email sender is not configured');
  });
});
