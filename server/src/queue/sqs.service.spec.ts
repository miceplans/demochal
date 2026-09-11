import { DeleteMessageCommand, ReceiveMessageCommand, SendMessageCommand } from '@aws-sdk/client-sqs';
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
        input: { QueueUrl: 'https://example.test/queue', MessageBody: '{"challengeId":"challenge-1"}' },
      }),
    );
    expect(send.mock.calls[0]![0]).toBeInstanceOf(SendMessageCommand);
    expect(send.mock.calls[1]![0]).toBeInstanceOf(ReceiveMessageCommand);
    expect(send.mock.calls[2]![0]).toBeInstanceOf(DeleteMessageCommand);
    await expect(service.receiveMessages('https://example.test/queue')).resolves.toEqual([]);
  });
});
