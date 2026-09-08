import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module.js';
import { env } from './config/env.js';
import { SqsService } from './queue/sqs.service.js';
import { VerificationsProcessorService } from './modules/verifications/verifications.processor.js';
import type { VerificationJobMessage } from './modules/verifications/verifications.service.js';

// SQS consumer entry point — no HTTP server, no ALB/external inbound access.
async function bootstrap() {
  const logger = new Logger('Worker');
  const app = await NestFactory.createApplicationContext(WorkerModule);

  const sqsService = app.get(SqsService);
  const verificationsProcessor = app.get(VerificationsProcessorService);

  let shuttingDown = false;
  process.on('SIGTERM', () => (shuttingDown = true));
  process.on('SIGINT', () => (shuttingDown = true));

  logger.log('Worker started, polling SQS_VERIFICATIONS_QUEUE_URL');

  while (!shuttingDown) {
    if (!env.sqsVerificationsQueueUrl) {
      logger.warn('SQS_VERIFICATIONS_QUEUE_URL is not configured, idling');
      await new Promise((resolve) => setTimeout(resolve, 5000));
      continue;
    }

    const messages = await sqsService.receiveMessages(env.sqsVerificationsQueueUrl);
    for (const message of messages) {
      try {
        const body = JSON.parse(message.Body ?? '{}') as VerificationJobMessage;
        await verificationsProcessor.process(body);
        if (message.ReceiptHandle) {
          await sqsService.deleteMessage(env.sqsVerificationsQueueUrl, message.ReceiptHandle);
        }
      } catch (error) {
        logger.error('Failed to process message', error);
        // Left on the queue to be retried / eventually sent to a DLQ.
      }
    }
  }

  await app.close();
  logger.log('Worker stopped');
}

await bootstrap();
