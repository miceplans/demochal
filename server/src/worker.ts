import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module.js';
import { env } from './config/env.js';
import { SqsService } from './queue/sqs.service.js';
import { OutboxRelayService } from './outbox/outbox-relay.service.js';
import { VerificationsProcessorService } from './modules/verifications/verifications.processor.js';
import {
  VERIFICATION_SUBMITTED_EVENT,
  type VerificationJobMessage,
} from './modules/verifications/verifications.service.js';
import { ChallengeNotificationScanService } from './modules/notifications/challenge-notification-scan.service.js';
import { NotificationEmailProcessorService } from './modules/notifications/email/notification-email.processor.js';
import {
  NOTIFICATION_EMAIL_EVENT,
  isEmailDeliveryConfigured,
  parseNotificationEmailJob,
} from './modules/notifications/email/notification-email.js';
import { SupportEmailService } from './modules/notifications/email/support-email.service.js';
import {
  SUPPORT_EMAIL_EVENT,
  isSupportEmailDeliveryConfigured,
  parseSupportEmailJob,
} from './modules/notifications/email/support-email.js';
import { EmailService } from './modules/email/email.service.js';

const CHALLENGE_SCAN_INTERVAL_MS = 60 * 60 * 1000;

// SQS consumer entry point — no HTTP server, no ALB/external inbound access.
async function bootstrap() {
  const logger = new Logger('Worker');
  const app = await NestFactory.createApplicationContext(WorkerModule);

  const sqsService = app.get(SqsService);
  const outboxRelayService = app.get(OutboxRelayService);
  const verificationsProcessor = app.get(VerificationsProcessorService);
  const notificationEmailProcessor = app.get(NotificationEmailProcessorService);
  const supportEmailService = app.get(SupportEmailService);
  const emailService = app.get(EmailService);

  const challengeNotificationScan = app.get(ChallengeNotificationScanService);
  let lastChallengeScanAt = 0;

  let shuttingDown = false;
  process.on('SIGTERM', () => (shuttingDown = true));
  process.on('SIGINT', () => (shuttingDown = true));

  const notificationEmailEnabled = isEmailDeliveryConfigured();
  const supportEmailEnabled = isSupportEmailDeliveryConfigured();
  const emailEnabled = notificationEmailEnabled || supportEmailEnabled;
  logger.log(
    `Worker started (verifications queue: ${env.sqsVerificationsQueueUrl ? 'on' : 'off'}, ` +
      `email queue: ${emailEnabled ? 'on' : 'off — SES_FROM_EMAIL/SES_SUPPORT_FROM_EMAIL/SQS_EMAILS_QUEUE_URL unset'}, ` +
      `inbound queue: ${env.sqsInboundEmailsQueueUrl ? 'on' : 'off'})`,
  );

  while (!shuttingDown) {
    await scanChallengeNotifications();

    if (!env.sqsVerificationsQueueUrl && !emailEnabled && !env.sqsInboundEmailsQueueUrl) {
      logger.warn('No worker queue is configured, idling');
      await new Promise((resolve) => setTimeout(resolve, 5000));
      continue;
    }

    if (env.sqsVerificationsQueueUrl) {
      await pollVerifications(env.sqsVerificationsQueueUrl);
    }
    if (emailEnabled) {
      await pollEmails(env.sqsEmailsQueueUrl);
    }
    if (env.sqsInboundEmailsQueueUrl) {
      await pollInboundEmails(env.sqsInboundEmailsQueueUrl);
    }
  }

  // A transient SQS/network failure on one queue must not reject bootstrap()
  // and kill the process (stopping every consumer); back off and let the
  // loop try again.
  async function receive(queueUrl: string, label: string) {
    try {
      return await sqsService.receiveMessages(queueUrl);
    } catch (error) {
      const name = error instanceof Error ? error.name : 'UnknownError';
      logger.error(`Receiving from the ${label} queue failed (${name}), backing off`);
      await new Promise((resolve) => setTimeout(resolve, 5000));
      return [];
    }
  }

  // 마감/공고 알림은 큐 설정과 무관하게 주기적으로 DB를 스캔해 만든다(중복은 dedupeKey로 차단).
  async function scanChallengeNotifications() {
    if (Date.now() - lastChallengeScanAt < CHALLENGE_SCAN_INTERVAL_MS) return;
    lastChallengeScanAt = Date.now();
    try {
      const { created } = await challengeNotificationScan.scan();
      if (created > 0) logger.log(`Created ${created} challenge notifications`);
    } catch (error) {
      const name = error instanceof Error ? error.name : 'UnknownError';
      logger.error(`Challenge notification scan failed (${name})`);
    }
  }

  async function pollVerifications(queueUrl: string) {
    try {
      await outboxRelayService.relay(VERIFICATION_SUBMITTED_EVENT, queueUrl);
    } catch (error) {
      logger.error('Outbox relay pass failed', error);
    }

    const messages = await receive(queueUrl, 'verifications');
    for (const message of messages) {
      try {
        const body = JSON.parse(message.Body ?? '{}') as VerificationJobMessage;
        await verificationsProcessor.process(body);
        if (message.ReceiptHandle) {
          await sqsService.deleteMessage(queueUrl, message.ReceiptHandle);
        }
      } catch (error) {
        logger.error('Failed to process message', error);
        // Left on the queue to be retried / eventually sent to a DLQ.
      }
    }
  }

  async function pollEmails(queueUrl: string) {
    // The envelope carries the outbox event id, the email idempotency key. Each
    // event type is relayed only when its sender is configured, so enabling one
    // sender never flushes (or drops) the other's backlog.
    for (const [enabled, eventType] of [
      [notificationEmailEnabled, NOTIFICATION_EMAIL_EVENT],
      [supportEmailEnabled, SUPPORT_EMAIL_EVENT],
    ] as const) {
      if (!enabled) continue;
      try {
        await outboxRelayService.relay(eventType, queueUrl, 10, { includeEventId: true });
      } catch (error) {
        logger.error(`Email outbox relay pass failed (${eventType})`, error);
      }
    }

    const messages = await receive(queueUrl, 'email');
    for (const message of messages) {
      try {
        const body: unknown = JSON.parse(message.Body ?? '{}');
        const supportJob = parseSupportEmailJob(body);
        if (supportJob) {
          await supportEmailService.process(supportJob);
        } else {
          const job = parseNotificationEmailJob(body);
          // A malformed body can never succeed; throwing lets it reach the DLQ
          // after maxReceiveCount instead of silently dropping it.
          if (!job) throw new Error(`Malformed email job ${message.MessageId ?? ''}`);
          await notificationEmailProcessor.process(job);
        }
        if (message.ReceiptHandle) {
          await sqsService.deleteMessage(queueUrl, message.ReceiptHandle);
        }
      } catch (error) {
        // Only the error name: SES/DB errors can echo the recipient address.
        const name = error instanceof Error ? error.name : 'UnknownError';
        logger.error(`Failed to process email message ${message.MessageId ?? ''} (${name})`);
        // Left on the queue to be retried / eventually sent to a DLQ.
      }
    }
  }

  async function pollInboundEmails(queueUrl: string) {
    const messages = await receive(queueUrl, 'inbound email');
    for (const message of messages) {
      try {
        const body = JSON.parse(message.Body ?? '{}');
        if (!body.messageId || !body.from || !body.to || !body.subject || !body.sentAt) {
          throw new Error(`Malformed inbound email message ${message.MessageId ?? ''}`);
        }
        await emailService.ingestInbound(body);
        if (message.ReceiptHandle) await sqsService.deleteMessage(queueUrl, message.ReceiptHandle);
      } catch (error) {
        const name = error instanceof Error ? error.name : 'UnknownError';
        logger.error(`Failed to process inbound email ${message.MessageId ?? ''} (${name})`);
      }
    }
  }

  await app.close();
  logger.log('Worker stopped');
}

await bootstrap();
