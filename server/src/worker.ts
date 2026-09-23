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
import { NotificationEmailProcessorService } from './modules/notifications/email/notification-email.processor.js';
import {
  NOTIFICATION_EMAIL_EVENT,
  isEmailDeliveryConfigured,
  parseNotificationEmailJob,
} from './modules/notifications/email/notification-email.js';

// SQS consumer entry point — no HTTP server, no ALB/external inbound access.
async function bootstrap() {
  const logger = new Logger('Worker');
  const app = await NestFactory.createApplicationContext(WorkerModule);

  const sqsService = app.get(SqsService);
  const outboxRelayService = app.get(OutboxRelayService);
  const verificationsProcessor = app.get(VerificationsProcessorService);
  const notificationEmailProcessor = app.get(NotificationEmailProcessorService);

  let shuttingDown = false;
  process.on('SIGTERM', () => (shuttingDown = true));
  process.on('SIGINT', () => (shuttingDown = true));

  const emailEnabled = isEmailDeliveryConfigured();
  logger.log(
    `Worker started (verifications queue: ${env.sqsVerificationsQueueUrl ? 'on' : 'off'}, ` +
      `email queue: ${emailEnabled ? 'on' : 'off — SES_FROM_EMAIL/SQS_EMAILS_QUEUE_URL unset'})`,
  );

  while (!shuttingDown) {
    if (!env.sqsVerificationsQueueUrl && !emailEnabled) {
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
    try {
      // The envelope carries the outbox event id, the email idempotency key.
      await outboxRelayService.relay(NOTIFICATION_EMAIL_EVENT, queueUrl, 10, {
        includeEventId: true,
      });
    } catch (error) {
      logger.error('Email outbox relay pass failed', error);
    }

    const messages = await receive(queueUrl, 'email');
    for (const message of messages) {
      try {
        const job = parseNotificationEmailJob(JSON.parse(message.Body ?? '{}'));
        // A malformed body can never succeed; throwing lets it reach the DLQ
        // after maxReceiveCount instead of silently dropping it.
        if (!job) throw new Error(`Malformed email job ${message.MessageId ?? ''}`);
        await notificationEmailProcessor.process(job);
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

  await app.close();
  logger.log('Worker stopped');
}

await bootstrap();
