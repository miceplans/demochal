import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { env } from '../../../config/env.js';
import { SesEmailClient } from './ses-email.client.js';

describe('SesEmailClient', () => {
  const originalFrom = env.sesFromEmail;

  afterEach(() => {
    env.sesFromEmail = originalFrom;
    vi.restoreAllMocks();
  });

  it('reports configuration from SES_FROM_EMAIL', () => {
    env.sesFromEmail = '';
    expect(new SesEmailClient().isConfigured()).toBe(false);
    env.sesFromEmail = 'no-reply@miceplans.com';
    expect(new SesEmailClient().isConfigured()).toBe(true);
  });

  it('sends a SESv2 simple email with UTF-8 text and html bodies', async () => {
    env.sesFromEmail = 'no-reply@miceplans.com';
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
      FromEmailAddress: 'no-reply@miceplans.com',
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
    env.sesFromEmail = 'no-reply@miceplans.com';
    vi.spyOn(SESv2Client.prototype, 'send').mockRejectedValue(new Error('Throttling'));

    await expect(
      new SesEmailClient().send({ to: 'a@b.c', subject: 's', text: 't', html: 'h' }),
    ).rejects.toThrow('Throttling');
  });
});
