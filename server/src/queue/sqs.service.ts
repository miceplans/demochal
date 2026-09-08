import { Injectable } from '@nestjs/common';
import {
  SQSClient,
  SendMessageCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand,
} from '@aws-sdk/client-sqs';
import { env } from '../config/env.js';

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

  // Long-polls a single batch of messages. Used by worker.ts's poll loop.
  async receiveMessages(queueUrl: string, maxMessages = 10) {
    const result = await this.client.send(
      new ReceiveMessageCommand({
        QueueUrl: queueUrl,
        MaxNumberOfMessages: maxMessages,
        WaitTimeSeconds: 20,
      }),
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
}
