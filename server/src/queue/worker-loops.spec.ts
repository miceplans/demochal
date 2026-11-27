import type { Message } from '@aws-sdk/client-sqs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VisibilityHeartbeat, runPeriodic, runQueueConsumer, sleep } from './worker-loops.js';

const logger = { error: vi.fn(), warn: vi.fn() };

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

function message(id: string): Message {
  return { MessageId: id, ReceiptHandle: `rh-${id}`, Body: '{}' };
}

describe('sleep', () => {
  it('resolves immediately when the signal aborts', async () => {
    const controller = new AbortController();
    const done = sleep(60_000, controller.signal);
    controller.abort();
    await expect(done).resolves.toBeUndefined();
  });
});

describe('runPeriodic', () => {
  it('runs the task right away, survives failures, and stops on abort', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const task = vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValue(undefined);

    const loop = runPeriodic('Scan', 1000, task, controller.signal, logger);
    await vi.advanceTimersByTimeAsync(0);
    expect(task).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith('Scan failed (Error)');

    await vi.advanceTimersByTimeAsync(1000);
    expect(task).toHaveBeenCalledTimes(2);

    controller.abort();
    await loop;
    expect(task).toHaveBeenCalledTimes(2);
  });
});

describe('VisibilityHeartbeat', () => {
  it('extends only unfinished messages of the batch on every tick', async () => {
    vi.useFakeTimers();
    const sqs = { changeVisibilityBatch: vi.fn().mockResolvedValue(undefined) };
    const heartbeat = new VisibilityHeartbeat(sqs, 'queue', [message('a'), message('b')], logger, {
      intervalMs: 1000,
      visibilityTimeoutSeconds: 120,
    });

    await vi.advanceTimersByTimeAsync(1000);
    expect(sqs.changeVisibilityBatch).toHaveBeenLastCalledWith(
      'queue',
      [
        { id: 'm0', receiptHandle: 'rh-a' },
        { id: 'm1', receiptHandle: 'rh-b' },
      ],
      120,
    );

    heartbeat.release('rh-a');
    await vi.advanceTimersByTimeAsync(1000);
    expect(sqs.changeVisibilityBatch).toHaveBeenLastCalledWith(
      'queue',
      [{ id: 'm1', receiptHandle: 'rh-b' }],
      120,
    );

    heartbeat.stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(sqs.changeVisibilityBatch).toHaveBeenCalledTimes(2);
  });

  it('gives up after the max extension so a hung handler cannot hold a message forever', async () => {
    vi.useFakeTimers();
    const sqs = { changeVisibilityBatch: vi.fn().mockResolvedValue(undefined) };
    new VisibilityHeartbeat(sqs, 'queue', [message('a')], logger, {
      intervalMs: 1000,
      maxExtensionMs: 2500,
    });

    await vi.advanceTimersByTimeAsync(10_000);
    expect(sqs.changeVisibilityBatch).toHaveBeenCalledTimes(2);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Stopped extending'));
  });
});

describe('runQueueConsumer', () => {
  it('deletes handled messages, leaves failed ones, and keeps a slow batch invisible', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const receiveMessages = vi
      .fn()
      .mockResolvedValueOnce([message('ok'), message('bad'), message('slow')])
      .mockImplementation(async () => {
        controller.abort();
        return [];
      });
    const sqs = {
      receiveMessages,
      deleteMessage: vi.fn().mockResolvedValue(undefined),
      changeVisibilityBatch: vi.fn().mockResolvedValue(undefined),
    };
    const handle = vi.fn(async (msg: Message) => {
      if (msg.MessageId === 'bad') throw new Error('nope');
      if (msg.MessageId === 'slow') await new Promise((resolve) => setTimeout(resolve, 2500));
    });

    const loop = runQueueConsumer(
      sqs,
      { queueUrl: 'queue', label: 'test', handle, heartbeat: { intervalMs: 1000 } },
      controller.signal,
      logger,
    );
    await vi.advanceTimersByTimeAsync(3000);
    await loop;

    expect(sqs.deleteMessage.mock.calls).toEqual([
      ['queue', 'rh-ok'],
      ['queue', 'rh-slow'],
    ]);
    expect(logger.error).toHaveBeenCalledWith('Failed to process test message bad (Error)');
    // While "slow" ran, only it was still in flight.
    expect(sqs.changeVisibilityBatch).toHaveBeenCalledWith(
      'queue',
      [{ id: 'm2', receiptHandle: 'rh-slow' }],
      120,
    );
    expect(receiveMessages).toHaveBeenCalledWith('queue', { abortSignal: controller.signal });
  });

  it('backs off after a receive failure instead of crashing the loop', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const receiveMessages = vi
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockImplementation(async () => {
        controller.abort();
        return [];
      });
    const sqs = {
      receiveMessages,
      deleteMessage: vi.fn(),
      changeVisibilityBatch: vi.fn(),
    };

    const loop = runQueueConsumer(
      sqs,
      { queueUrl: 'queue', label: 'test', handle: vi.fn(), receiveErrorBackoffMs: 1000 },
      controller.signal,
      logger,
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(receiveMessages).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    await loop;
    expect(receiveMessages).toHaveBeenCalledTimes(2);
    expect(logger.error).toHaveBeenCalledWith(
      'Receiving from the test queue failed (Error), backing off',
    );
  });

  it('does not wait on another queue: two consumers poll independently', async () => {
    const controller = new AbortController();
    // Queue A never returns (an empty long poll); queue B must still be served.
    const receiveMessages = vi.fn((queueUrl: string) =>
      queueUrl === 'a'
        ? new Promise<Message[]>((resolve) =>
            controller.signal.addEventListener('abort', () => resolve([])),
          )
        : Promise.resolve([message('b1')]),
    );
    const sqs = {
      receiveMessages,
      deleteMessage: vi.fn().mockResolvedValue(undefined),
      changeVisibilityBatch: vi.fn(),
    };
    const handleB = vi.fn(async () => controller.abort());

    await Promise.all([
      runQueueConsumer(
        sqs,
        { queueUrl: 'a', label: 'a', handle: vi.fn() },
        controller.signal,
        logger,
      ),
      runQueueConsumer(
        sqs,
        { queueUrl: 'b', label: 'b', handle: handleB },
        controller.signal,
        logger,
      ),
    ]);
    expect(handleB).toHaveBeenCalledTimes(1);
    expect(sqs.deleteMessage).toHaveBeenCalledWith('b', 'rh-b1');
  });
});
