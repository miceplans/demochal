import { Injectable } from '@nestjs/common';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { env } from '../../../config/env.js';

export interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
  html: string;
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

  isConfigured(): boolean {
    return Boolean(env.sesFromEmail);
  }

  async send(email: OutgoingEmail): Promise<void> {
    await this.client.send(
      new SendEmailCommand({
        FromEmailAddress: env.sesFromEmail,
        Destination: { ToAddresses: [email.to] },
        Content: {
          Simple: {
            Subject: { Data: email.subject, Charset: 'UTF-8' },
            Body: {
              Text: { Data: email.text, Charset: 'UTF-8' },
              Html: { Data: email.html, Charset: 'UTF-8' },
            },
          },
        },
      }),
    );
  }
}
