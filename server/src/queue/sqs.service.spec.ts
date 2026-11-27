import {
  ChangeMessageVisibilityBatchCommand,
  DeleteMessageCommand,
  ReceiveMessageCommand,
  SendMessageCommand,
} from '@aws-sdk/client-sqs';
import { describe, expect, it, vi } from 'vitest';
import { SqsService } from './sqs.service.js';

describe('SqsService', () => {
  it('serializes outgoing messages and returns an empty array for an empty receive response', async () => {
    const service = new SqsService();
    const send = vi.fn().mockResolvedValue({});
    Object.defineProperty(service, 'client', { value: { send } });

    await service.sendMessage('https://example.test/queue', { challengeId: 'challenge-1' });
    await service.receiveMessages('https://example.test/queue');
    await service.deleteMessage('https://example.test/queue', 'receipt-1');

    expect(send).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        input: {
          QueueUrl: 'https://example.test/queue',
          MessageBody: '{"challengeId":"challenge-1"}',
        },
      }),
    );
    expect(send.mock.calls[0]![0]).toBeInstanceOf(SendMessageCommand);
    expect(send.mock.calls[1]![0]).toBeInstanceOf(ReceiveMessageCommand);
    expect(send.mock.calls[2]![0]).toBeInstanceOf(DeleteMessageCommand);
    await expect(service.receiveMessages('https://example.test/queue')).resolves.toEqual([]);
  });
});

describe('SqsService receive/visibility', () => {
  it('receives with an explicit visibility timeout and forwards the abort signal', async () => {
    const service = new SqsService();
    const send = vi.fn().mockResolvedValue({ Messages: [{ MessageId: 'm' }] });
    Object.defineProperty(service, 'client', { value: { send } });
    const controller = new AbortController();

    await expect(
      service.receiveMessages('https://example.test/queue', { abortSignal: controller.signal }),
    ).resolves.toEqual([{ MessageId: 'm' }]);
    expect(send.mock.calls[0]![0].input).toEqual({
      QueueUrl: 'https://example.test/queue',
      MaxNumberOfMessages: 10,
      WaitTimeSeconds: 20,
      VisibilityTimeout: 120,
    });
    expect(send.mock.calls[0]![1]).toEqual({ abortSignal: controller.signal });
  });

  it('extends visibility for a batch and skips the call for an empty batch', async () => {
    const service = new SqsService();
    const send = vi.fn().mockResolvedValue({});
    Object.defineProperty(service, 'client', { value: { send } });

    await service.changeVisibilityBatch('https://example.test/queue', [], 120);
    expect(send).not.toHaveBeenCalled();

    await service.changeVisibilityBatch(
      'https://example.test/queue',
      [{ id: 'm0', receiptHandle: 'rh-0' }],
      120,
    );
    expect(send.mock.calls[0]![0]).toBeInstanceOf(ChangeMessageVisibilityBatchCommand);
    expect(send.mock.calls[0]![0].input).toEqual({
      QueueUrl: 'https://example.test/queue',
      Entries: [{ Id: 'm0', ReceiptHandle: 'rh-0', VisibilityTimeout: 120 }],
    });
  });
});
