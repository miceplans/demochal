import { Injectable } from '@nestjs/common';
import {
  SQSClient,
  SendMessageCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  ChangeMessageVisibilityBatchCommand,
} from '@aws-sdk/client-sqs';
import { env } from '../config/env.js';

// Matches visibility_timeout_seconds on every worker queue (infra/terraform/data.tf).
// Passed explicitly on receive so the code and the queue default cannot drift apart.
export const SQS_VISIBILITY_TIMEOUT_SECONDS = 120;
export const SQS_LONG_POLL_SECONDS = 20;

@Injectable()
export class SqsService {
  private readonly client = new SQSClient({ region: env.awsRegion });

  async sendMessage(queueUrl: string, body: unknown): Promise<void> {
    await this.client.send(
      new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: JSON.stringify(body),
      }),
    );
  }

  // Long-polls a single batch of messages. Used by worker.ts's per-queue consumer
  // loops. `abortSignal` lets shutdown cut the up-to-20s wait short.
  async receiveMessages(queueUrl: string, options?: { abortSignal?: AbortSignal }) {
    const result = await this.client.send(
      new ReceiveMessageCommand({
        QueueUrl: queueUrl,
        MaxNumberOfMessages: 10,
        WaitTimeSeconds: SQS_LONG_POLL_SECONDS,
        VisibilityTimeout: SQS_VISIBILITY_TIMEOUT_SECONDS,
      }),
      options?.abortSignal ? { abortSignal: options.abortSignal } : undefined,
    );
    return result.Messages ?? [];
  }

  async deleteMessage(queueUrl: string, receiptHandle: string): Promise<void> {
    await this.client.send(
      new DeleteMessageCommand({
        QueueUrl: queueUrl,
        ReceiptHandle: receiptHandle,
      }),
    );
  }

  // Resets the visibility timeout of up to 10 in-flight messages (one receive batch)
  // so a slow batch is not redelivered to another consumer mid-processing.
  async changeVisibilityBatch(
    queueUrl: string,
    entries: { id: string; receiptHandle: string }[],
    visibilityTimeoutSeconds: number,
  ): Promise<void> {
    if (entries.length === 0) return;
    await this.client.send(
      new ChangeMessageVisibilityBatchCommand({
        QueueUrl: queueUrl,
        Entries: entries.map((entry) => ({
          Id: entry.id,
          ReceiptHandle: entry.receiptHandle,
          VisibilityTimeout: visibilityTimeoutSeconds,
        })),
      }),
    );
  }
}
