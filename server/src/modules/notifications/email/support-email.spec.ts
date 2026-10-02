import { afterEach, describe, expect, it } from 'vitest';
import { env } from '../../../config/env.js';
import { isSupportEmailDeliveryConfigured, parseSupportEmailJob } from './support-email.js';

describe('parseSupportEmailJob', () => {
  it('accepts an envelope with an email message id', () => {
    expect(parseSupportEmailJob({ eventId: 'e1', payload: { emailMessageId: 'm1' } })).toEqual({
      eventId: 'e1',
      payload: { emailMessageId: 'm1' },
    });
  });

  it('rejects notification jobs and malformed bodies', () => {
    expect(parseSupportEmailJob({ eventId: 'e1', payload: { notificationId: 'n1' } })).toBeNull();
    expect(parseSupportEmailJob({ payload: { emailMessageId: 'm1' } })).toBeNull();
    expect(parseSupportEmailJob(null)).toBeNull();
  });
});

describe('isSupportEmailDeliveryConfigured', () => {
  const original = { from: env.sesSupportFromEmail, queue: env.sqsEmailsQueueUrl };
  afterEach(() => {
    env.sesSupportFromEmail = original.from;
    env.sqsEmailsQueueUrl = original.queue;
  });

  it('needs both the support sender and the emails queue', () => {
    env.sesSupportFromEmail = 'help@semochall.com';
    env.sqsEmailsQueueUrl = '';
    expect(isSupportEmailDeliveryConfigured()).toBe(false);
    env.sqsEmailsQueueUrl = 'https://sqs.example/q';
    expect(isSupportEmailDeliveryConfigured()).toBe(true);
    env.sesSupportFromEmail = '';
    expect(isSupportEmailDeliveryConfigured()).toBe(false);
  });
});
