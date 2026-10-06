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
  parseNotificationEmailJob,
} from './modules/notifications/email/notification-email.js';
import { EmailService } from './modules/email/email.service.js';
import { SupportEmailProcessorService } from './modules/notifications/email/support-email.processor.js';
import {
  SUPPORT_EMAIL_EVENT,
  parseSupportEmailJob,
} from './modules/notifications/email/support-email.js';
import { PaymentsService } from './modules/payments/payments.service.js';

const CHALLENGE_SCAN_INTERVAL_MS = 60 * 60 * 1000;
const REFUND_PENDING_SCAN_INTERVAL_MS = 10 * 60 * 1000;

// SQS consumer entry point — no HTTP server, no ALB/external inbound access.
async function bootstrap() {
  const logger = new Logger('Worker');
  const app = await NestFactory.createApplicationContext(WorkerModule);

  const sqsService = app.get(SqsService);
  const outboxRelayService = app.get(OutboxRelayService);
  const verificationsProcessor = app.get(VerificationsProcessorService);
  const notificationEmailProcessor = app.get(NotificationEmailProcessorService);
  const emailService = app.get(EmailService);
  const supportEmailProcessor = app.get(SupportEmailProcessorService);

  const challengeNotificationScan = app.get(ChallengeNotificationScanService);
  let lastChallengeScanAt = 0;

  const paymentsService = app.get(PaymentsService);
  let lastRefundPendingScanAt = 0;

  let shuttingDown = false;
  process.on('SIGTERM', () => (shuttingDown = true));
  process.on('SIGINT', () => (shuttingDown = true));

  const emailEnabled = Boolean(
    env.sqsEmailsQueueUrl && (env.sesFromEmail || env.sesSupportFromEmail),
  );
  logger.log(
    `Worker started (verifications queue: ${env.sqsVerificationsQueueUrl ? 'on' : 'off'}, ` +
      `email queue: ${emailEnabled ? 'on' : 'off — SES_FROM_EMAIL/SQS_EMAILS_QUEUE_URL unset'}, ` +
      `inbound queue: ${env.sqsInboundEmailsQueueUrl ? 'on' : 'off'})`,
  );

  while (!shuttingDown) {
    await scanChallengeNotifications();
    await scanRefundPendingPayments();

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

  // 환불 보상이 실패한 결제(refund_pending)도 큐 설정과 무관하게 주기적으로
  // 재스캔해 Toss 취소를 재시도한다(백오프/상한은 PaymentsService가 관리).
  async function scanRefundPendingPayments() {
    if (Date.now() - lastRefundPendingScanAt < REFUND_PENDING_SCAN_INTERVAL_MS) return;
    lastRefundPendingScanAt = Date.now();
    try {
      const result = await paymentsService.retryRefundPendingPayments();
      if (result.attempted > 0) {
        logger.log(
          `Refund retry scan: ${result.refunded} refunded, ${result.failed} failed ` +
            `of ${result.attempted} attempted (${result.scanned} pending)`,
        );
      }
    } catch (error) {
      const name = error instanceof Error ? error.name : 'UnknownError';
      logger.error(`Refund pending scan failed (${name})`);
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
    try {
      await outboxRelayService.relay(SUPPORT_EMAIL_EVENT, queueUrl, 10, { includeEventId: true });
    } catch (error) {
      logger.error('Support email outbox relay pass failed', error);
    }

    const messages = await receive(queueUrl, 'email');
    for (const message of messages) {
      try {
        const body = JSON.parse(message.Body ?? '{}');
        const job = parseNotificationEmailJob(body);
        const supportJob = parseSupportEmailJob(body);
        // A malformed body can never succeed; throwing lets it reach the DLQ
        // after maxReceiveCount instead of silently dropping it.
        if (job) await notificationEmailProcessor.process(job);
        else if (supportJob) await supportEmailProcessor.process(supportJob);
        else throw new Error(`Malformed email job ${message.MessageId ?? ''}`);
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
