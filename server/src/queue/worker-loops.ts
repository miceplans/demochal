import type { Message } from '@aws-sdk/client-sqs';
import { SQS_VISIBILITY_TIMEOUT_SECONDS, type SqsService } from './sqs.service.js';

type LoopLogger = { error(message: string): void; warn(message: string): void };

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : 'UnknownError';
}

/** Resolves after `ms`, or right away once `signal` aborts (shutdown must not wait out a sleep). */
export function sleep(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Runs `task` now and then every `intervalMs` until `signal` aborts. Each periodic
 * scan gets its own loop so a slow scan never delays a queue consumer or another scan.
 * A failure is logged (error name only — payloads can carry personal data) and the
 * loop keeps going.
 */
export async function runPeriodic(
  name: string,
  intervalMs: number,
  task: () => Promise<void>,
  signal: AbortSignal,
  logger: LoopLogger,
): Promise<void> {
  while (!signal.aborted) {
    try {
      await task();
    } catch (error) {
      logger.error(`${name} failed (${errorName(error)})`);
    }
    await sleep(intervalMs, signal);
  }
}

export type HeartbeatOptions = {
  /** How often to push the visibility timeout out again. Must be well under the timeout. */
  intervalMs?: number;
  visibilityTimeoutSeconds?: number;
  /**
   * Stop extending after this long so a hung handler cannot hold a message forever —
   * it then reappears and eventually reaches the DLQ via maxReceiveCount.
   */
  maxExtensionMs?: number;
};

export const DEFAULT_HEARTBEAT_INTERVAL_MS = 30_000;
export const DEFAULT_HEARTBEAT_MAX_EXTENSION_MS = 15 * 60 * 1000;

/**
 * Keeps every not-yet-finished message of one receive batch invisible while the batch
 * is processed serially. All messages in a batch start their visibility clock at
 * receive time, so without this the 10th message of a slow batch (or one slow
 * handler) could pass the 120s timeout and be processed twice.
 */
export class VisibilityHeartbeat {
  private readonly inFlight = new Map<string, string>();
  private readonly startedAt = Date.now();
  private readonly timer: NodeJS.Timeout;
  private readonly visibilityTimeoutSeconds: number;
  private readonly maxExtensionMs: number;
  private extending = false;

  constructor(
    private readonly sqs: Pick<SqsService, 'changeVisibilityBatch'>,
    private readonly queueUrl: string,
    messages: Message[],
    private readonly logger: LoopLogger,
    options: HeartbeatOptions = {},
  ) {
    this.visibilityTimeoutSeconds =
      options.visibilityTimeoutSeconds ?? SQS_VISIBILITY_TIMEOUT_SECONDS;
    this.maxExtensionMs = options.maxExtensionMs ?? DEFAULT_HEARTBEAT_MAX_EXTENSION_MS;
    messages.forEach((message, index) => {
      // Batch entry ids only need to be unique within the call.
      if (message.ReceiptHandle) this.inFlight.set(`m${index}`, message.ReceiptHandle);
    });
    this.timer = setInterval(() => {
      void this.extend();
    }, options.intervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS);
    this.timer.unref();
  }

  /** The message is finished (deleted, or left to be retried) — stop extending it. */
  release(receiptHandle: string | undefined): void {
    if (!receiptHandle) return;
    for (const [id, handle] of this.inFlight) {
      if (handle === receiptHandle) this.inFlight.delete(id);
    }
  }

  stop(): void {
    clearInterval(this.timer);
    this.inFlight.clear();
  }

  private async extend(): Promise<void> {
    if (this.extending || this.inFlight.size === 0) return;
    if (Date.now() - this.startedAt >= this.maxExtensionMs) {
      this.logger.warn(
        `Stopped extending visibility for ${this.inFlight.size} message(s) after ` +
          `${Math.round(this.maxExtensionMs / 1000)}s; they may be redelivered`,
      );
      this.stop();
      return;
    }
    this.extending = true;
    try {
      await this.sqs.changeVisibilityBatch(
        this.queueUrl,
        [...this.inFlight].map(([id, receiptHandle]) => ({ id, receiptHandle })),
        this.visibilityTimeoutSeconds,
      );
    } catch (error) {
      // The next tick retries; worst case is the pre-heartbeat behaviour (redelivery).
      this.logger.warn(`Extending message visibility failed (${errorName(error)})`);
    } finally {
      this.extending = false;
    }
  }
}

export type QueueConsumerOptions = {
  queueUrl: string;
  label: string;
  /** Processes one message; throwing leaves it on the queue for retry / DLQ. */
  handle: (message: Message) => Promise<void>;
  /** Logs a handler failure; the default logs only the error name. */
  onError?: (message: Message, error: unknown) => void;
  receiveErrorBackoffMs?: number;
  heartbeat?: HeartbeatOptions;
};

/**
 * Long-polls one queue in its own loop until `signal` aborts. Queues no longer wait on
 * each other: an empty queue's 20s long poll only blocks that queue's loop.
 */
export async function runQueueConsumer(
  sqs: Pick<SqsService, 'receiveMessages' | 'deleteMessage' | 'changeVisibilityBatch'>,
  options: QueueConsumerOptions,
  signal: AbortSignal,
  logger: LoopLogger,
): Promise<void> {
  const backoffMs = options.receiveErrorBackoffMs ?? 5000;
  while (!signal.aborted) {
    let messages: Message[];
    try {
      messages = await sqs.receiveMessages(options.queueUrl, { abortSignal: signal });
    } catch (error) {
      if (signal.aborted) break;
      // A transient SQS/network failure must not kill this (or any other) consumer.
      logger.error(
        `Receiving from the ${options.label} queue failed (${errorName(error)}), backing off`,
      );
      await sleep(backoffMs, signal);
      continue;
    }
    if (messages.length === 0) continue;

    // Messages already received are finished even during shutdown: they are invisible
    // to other consumers until the timeout, so dropping them would only delay them.
    const heartbeat = new VisibilityHeartbeat(
      sqs,
      options.queueUrl,
      messages,
      logger,
      options.heartbeat,
    );
    try {
      for (const message of messages) {
        try {
          await options.handle(message);
          if (message.ReceiptHandle) {
            await sqs.deleteMessage(options.queueUrl, message.ReceiptHandle);
          }
        } catch (error) {
          if (options.onError) options.onError(message, error);
          else {
            logger.error(
              `Failed to process ${options.label} message ${message.MessageId ?? ''} (${errorName(error)})`,
            );
          }
          // Left on the queue to be retried / eventually sent to a DLQ.
        } finally {
          heartbeat.release(message.ReceiptHandle);
        }
      }
    } finally {
      heartbeat.stop();
    }
  }
}
