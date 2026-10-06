import 'reflect-metadata';
import { UnauthorizedException } from '@nestjs/common';
import throttlerConstants from '@nestjs/throttler/dist/throttler.constants.js';
import type { Request } from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { env } from '../../config/env.js';
import { DEFAULT_THROTTLE, TOSS_WEBHOOK_THROTTLE } from '../../common/throttling/throttling.js';
import { parseIpAllowlist } from '../../common/throttling/ip-allowlist.js';
import { PaymentsController } from './payments.controller.js';
import type { PaymentsService, TossWebhookPayload } from './payments.service.js';

const { THROTTLER_LIMIT, THROTTLER_TTL } = throttlerConstants;

const payload: TossWebhookPayload = {
  eventType: 'PAYMENT_STATUS_CHANGED',
  data: { paymentKey: 'payment-key', orderId: 'order-1', status: 'DONE' },
};

const requestFrom = (ip: string) => ({ ip }) as unknown as Request;

function createController() {
  const paymentsService = { handleTossWebhook: vi.fn().mockResolvedValue(undefined) };
  const controller = new PaymentsController(paymentsService as unknown as PaymentsService);
  return { controller, paymentsService };
}

describe('PaymentsController.handleTossWebhook', () => {
  afterEach(() => {
    env.tossWebhookAllowlist = [];
  });

  it('delegates to the service for any source IP when the allowlist is unset', async () => {
    env.tossWebhookAllowlist = [];
    const { controller, paymentsService } = createController();

    await expect(
      controller.handleTossWebhook(payload, requestFrom('203.0.113.10')),
    ).resolves.toEqual({ received: true });
    expect(paymentsService.handleTossWebhook).toHaveBeenCalledWith(payload);
  });

  it('rejects sources outside the allowlist with 401 without calling the service', async () => {
    env.tossWebhookAllowlist = parseIpAllowlist(['13.125.0.0/16', '15.165.23.123']);
    const { controller, paymentsService } = createController();

    await expect(
      controller.handleTossWebhook(payload, requestFrom('198.51.100.7')),
    ).rejects.toThrow(UnauthorizedException);
    expect(paymentsService.handleTossWebhook).not.toHaveBeenCalled();
  });

  it('allows sources inside the allowlist (exact and CIDR entries)', async () => {
    env.tossWebhookAllowlist = parseIpAllowlist(['13.125.0.0/16', '15.165.23.123']);
    const { controller, paymentsService } = createController();

    await expect(controller.handleTossWebhook(payload, requestFrom('13.125.0.1'))).resolves.toEqual(
      { received: true },
    );
    await expect(
      controller.handleTossWebhook(payload, requestFrom('15.165.23.123')),
    ).resolves.toEqual({ received: true });
    expect(paymentsService.handleTossWebhook).toHaveBeenCalledTimes(2);
  });

  it('carries a stricter per-route throttle than the global default', () => {
    // @nestjs/throttler stores per-throttler metadata on the handler function
    // (see its Throttle decorator); read it back to prove the decorator landed.
    const handler = PaymentsController.prototype.handleTossWebhook;
    expect(Reflect.getMetadata(THROTTLER_TTL + 'default', handler)).toBe(
      TOSS_WEBHOOK_THROTTLE.default.ttl,
    );
    expect(Reflect.getMetadata(THROTTLER_LIMIT + 'default', handler)).toBe(
      TOSS_WEBHOOK_THROTTLE.default.limit,
    );
    expect(TOSS_WEBHOOK_THROTTLE.default.limit).toBeLessThan(DEFAULT_THROTTLE.limit);
  });
});
