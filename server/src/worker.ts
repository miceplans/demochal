import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { Message } from '@aws-sdk/client-sqs';
import { WorkerModule } from './worker.module.js';
import { env } from './config/env.js';
import { SqsService } from './queue/sqs.service.js';
import { runPeriodic, runQueueConsumer, sleep } from './queue/worker-loops.js';
import { OutboxRelayService } from './outbox/outbox-relay.service.js';
import { VerificationDocumentRetentionService } from './modules/verifications/verification-document-retention.service.js';
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
const KCP_APPROVAL_SCAN_INTERVAL_MS = 5 * 60 * 1000;
const VERIFICATION_DOCUMENT_RETENTION_SCAN_INTERVAL_MS = 60 * 60 * 1000;
// Outbox rows are relayed by their own loop, not between long polls, so a new
// email job reaches SQS within this delay instead of a full poll cycle.
const OUTBOX_RELAY_INTERVAL_MS = 2000;

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : 'UnknownError';
}

// SQS consumer entry point — no HTTP server, no ALB/external inbound access.
// Every queue consumer, the outbox relay and every periodic scan runs as its own
// concurrent loop, so an empty queue's 20s long poll never delays another queue
// or a scan.
async function bootstrap() {
  const logger = new Logger('Worker');
  const app = await NestFactory.createApplicationContext(WorkerModule);

  const sqsService = app.get(SqsService);
  const outboxRelayService = app.get(OutboxRelayService);
  const verificationDocumentRetention = app.get(VerificationDocumentRetentionService);
  const notificationEmailProcessor = app.get(NotificationEmailProcessorService);
  const emailService = app.get(EmailService);
  const supportEmailProcessor = app.get(SupportEmailProcessorService);
  const challengeNotificationScan = app.get(ChallengeNotificationScanService);
  const paymentsService = app.get(PaymentsService);

  const shutdown = new AbortController();
  process.on('SIGTERM', () => shutdown.abort());
  process.on('SIGINT', () => shutdown.abort());
  const signal = shutdown.signal;

  const emailEnabled = Boolean(
    env.sqsEmailsQueueUrl && (env.sesFromEmail || env.sesSupportFromEmail),
  );
  logger.log(
    `Worker started (email queue: ${emailEnabled ? 'on' : 'off — SES_FROM_EMAIL/SQS_EMAILS_QUEUE_URL unset'}, ` +
      `inbound queue: ${env.sqsInboundEmailsQueueUrl ? 'on' : 'off'})`,
  );
  if (!emailEnabled && !env.sqsInboundEmailsQueueUrl) {
    logger.warn('No worker queue is configured; only periodic scans will run');
  }

  const loops: Promise<void>[] = [
    // 마감/공고 알림은 큐 설정과 무관하게 주기적으로 DB를 스캔해 만든다(중복은 dedupeKey로 차단).
    runPeriodic(
      'Challenge notification scan',
      CHALLENGE_SCAN_INTERVAL_MS,
      async () => {
        const { created } = await challengeNotificationScan.scan();
        if (created > 0) logger.log(`Created ${created} challenge notifications`);
      },
      signal,
      logger,
    ),
    // 환불 보상이 실패한 결제(refund_pending)도 큐 설정과 무관하게 주기적으로
    // 재스캔해 Toss 취소를 재시도한다(백오프/상한은 PaymentsService가 관리).
    runPeriodic(
      'Refund pending scan',
      REFUND_PENDING_SCAN_INTERVAL_MS,
      async () => {
        const result = await paymentsService.retryRefundPendingPayments();
        if (result.attempted > 0) {
          logger.log(
            `Refund retry scan: ${result.refunded} refunded, ${result.failed} failed ` +
              `of ${result.attempted} attempted (${result.scanned} pending)`,
          );
        }
      },
      signal,
      logger,
    ),
    // 승인 응답이 유실된 KCP 결제를 거래조회로 확인해 정산하거나 취소한다.
    runPeriodic(
      'KCP approval scan',
      KCP_APPROVAL_SCAN_INTERVAL_MS,
      async () => {
        const result = await paymentsService.recoverKcpApprovals();
        if (result.scanned > 0) {
          logger.log(
            `KCP approval scan: ${result.settled} settled, ${result.compensated} compensated, ` +
              `${result.exhausted} need manual review of ${result.scanned}`,
          );
        }
      },
      signal,
      logger,
    ),
    // 사업자 서류(사업자등록증)는 보관 기한이 지나면 private 버킷에서 지운다(개인정보 최소 보관).
    runPeriodic(
      'Verification document retention scan',
      VERIFICATION_DOCUMENT_RETENTION_SCAN_INTERVAL_MS,
      async () => {
        const { deleted, failed } = await verificationDocumentRetention.purgeExpired();
        if (deleted > 0 || failed > 0) {
          logger.log(`Verification document retention: ${deleted} deleted, ${failed} failed`);
        }
      },
      signal,
      logger,
    ),
  ];

  const relays: (() => Promise<void>)[] = [];

  if (emailEnabled) {
    const queueUrl = env.sqsEmailsQueueUrl;
    // The envelope carries the outbox event id, the email idempotency key.
    relays.push(() =>
      outboxRelayService.relay(NOTIFICATION_EMAIL_EVENT, queueUrl, 10, { includeEventId: true }),
    );
    relays.push(() =>
      outboxRelayService.relay(SUPPORT_EMAIL_EVENT, queueUrl, 10, { includeEventId: true }),
    );
    loops.push(
      runQueueConsumer(
        sqsService,
        {
          queueUrl,
          label: 'email',
          handle: async (message: Message) => {
            const body = JSON.parse(message.Body ?? '{}');
            const job = parseNotificationEmailJob(body);
            const supportJob = parseSupportEmailJob(body);
            // A malformed body can never succeed; throwing lets it reach the DLQ
            // after maxReceiveCount instead of silently dropping it.
            if (job) await notificationEmailProcessor.process(job);
            else if (supportJob) await supportEmailProcessor.process(supportJob);
            else throw new Error(`Malformed email job ${message.MessageId ?? ''}`);
          },
          // Only the error name: SES/DB errors can echo the recipient address.
          onError: (message, error) =>
            logger.error(
              `Failed to process email message ${message.MessageId ?? ''} (${errorName(error)})`,
            ),
        },
        signal,
        logger,
      ),
    );
  }

  if (env.sqsInboundEmailsQueueUrl) {
    loops.push(
      runQueueConsumer(
        sqsService,
        {
          queueUrl: env.sqsInboundEmailsQueueUrl,
          label: 'inbound email',
          handle: async (message: Message) => {
            const body = JSON.parse(message.Body ?? '{}');
            if (!body.messageId || !body.from || !body.to || !body.subject || !body.sentAt) {
              throw new Error(`Malformed inbound email message ${message.MessageId ?? ''}`);
            }
            await emailService.ingestInbound(body);
          },
        },
        signal,
        logger,
      ),
    );
  }

  if (relays.length > 0) {
    loops.push(
      (async () => {
        while (!signal.aborted) {
          // Each event type is relayed independently so one failing relay does not
          // hold back the others.
          for (const relay of relays) {
            try {
              await relay();
            } catch (error) {
              logger.error(`Outbox relay pass failed (${errorName(error)})`);
            }
          }
          await sleep(OUTBOX_RELAY_INTERVAL_MS, signal);
        }
      })(),
    );
  }

  await Promise.all(loops);
  await app.close();
  logger.log('Worker stopped');
}

await bootstrap();
