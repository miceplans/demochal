import { Injectable } from '@nestjs/common';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { env } from '../../../config/env.js';

export interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
  html: string;
  fromEmail?: string;
  messageId?: string;
  inReplyTo?: string;
  references?: string;
}

// Thin SESv2 adapter used only by the worker's email processor. The sender
// identity (SES_FROM_EMAIL) must be a verified SES identity before production
// use — domain verification/DKIM is a manual step outside this code:
// TODO: verify the sending domain and request production access —
// https://docs.aws.amazon.com/ses/latest/dg/creating-identities.html
// https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html
@Injectable()
export class SesEmailClient {
  private readonly client = new SESv2Client({ region: env.awsRegion });

  isConfigured(from: 'noreply' | 'support' = 'noreply'): boolean {
    return Boolean(from === 'support' ? env.sesSupportFromEmail : env.sesFromEmail);
  }

  async send(email: OutgoingEmail): Promise<{ sesMessageId?: string }> {
    const headers = [
      email.messageId ? { Name: 'Message-ID', Value: email.messageId } : null,
      email.inReplyTo ? { Name: 'In-Reply-To', Value: email.inReplyTo } : null,
      email.references ? { Name: 'References', Value: email.references } : null,
    ].filter((header): header is { Name: string; Value: string } => header !== null);
    const response = await this.client.send(
      new SendEmailCommand({
        FromEmailAddress: email.fromEmail ?? env.sesFromEmail,
        Destination: { ToAddresses: [email.to] },
        Content: {
          Simple: {
            Subject: { Data: email.subject, Charset: 'UTF-8' },
            Body: {
              Text: { Data: email.text, Charset: 'UTF-8' },
              Html: { Data: email.html, Charset: 'UTF-8' },
            },
            ...(headers.length > 0 ? { Headers: headers } : {}),
          },
        },
      }),
    );
    return { sesMessageId: response.MessageId };
  }

  async sendSupportEmail(
    email: Omit<OutgoingEmail, 'fromEmail'>,
  ): Promise<{ sesMessageId?: string }> {
    if (!this.isConfigured('support')) throw new Error('Support email sender is not configured');
    return this.send({ ...email, fromEmail: env.sesSupportFromEmail });
  }
}
