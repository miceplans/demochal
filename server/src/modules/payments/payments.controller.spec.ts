import 'reflect-metadata';
import { UnauthorizedException } from '@nestjs/common';
import throttlerConstants from '@nestjs/throttler/dist/throttler.constants.js';
import type { Request, Response } from 'express';
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

describe('PaymentsController — KCP 네이버페이(bz)', () => {
  function createKcpController() {
    const paymentsService = {
      registerKcpTransaction: vi.fn(),
      confirmKcpPayment: vi.fn(),
      handleKcpMobileReturn: vi.fn(),
    };
    const controller = new PaymentsController(paymentsService as unknown as PaymentsService);
    return { controller, paymentsService };
  }

  it('delegates the trade registration to the service with the current user', async () => {
    const { controller, paymentsService } = createKcpController();
    paymentsService.registerKcpTransaction.mockResolvedValue({
      approvalKey: 'ak',
      payUrl: 'https://testsmpay.kcp.co.kr/pay/mobileGW.kcp',
      retUrl: 'http://localhost:3000/payments/kcp/return',
    });

    await expect(
      controller.registerKcp({ orderId: 'order-1', orderName: '광고', flow: 'ad' }, {
        id: 'user-1',
      } as never),
    ).resolves.toMatchObject({ approvalKey: 'ak' });
    expect(paymentsService.registerKcpTransaction).toHaveBeenCalledWith('user-1', {
      orderId: 'order-1',
      orderName: '광고',
      flow: 'ad',
    });
  });

  it('delegates the PC confirm to the service with the current user', async () => {
    const { controller, paymentsService } = createKcpController();
    paymentsService.confirmKcpPayment.mockResolvedValue({ id: 'order-1', status: 'paid' });

    await expect(
      controller.confirmKcp(
        { orderId: 'order-1', encData: 'enc-d', encInfo: 'enc-i', tranCd: '00100000' },
        { id: 'user-1' } as never,
      ),
    ).resolves.toEqual({ id: 'order-1', status: 'paid' });
    expect(paymentsService.confirmKcpPayment).toHaveBeenCalledWith('user-1', {
      orderId: 'order-1',
      encData: 'enc-d',
      encInfo: 'enc-i',
      tranCd: '00100000',
    });
  });

  it('returns the settled outcome for the mobile return so the front route can redirect', async () => {
    const { controller, paymentsService } = createKcpController();
    paymentsService.handleKcpMobileReturn.mockResolvedValue({
      outcome: 'success',
      orderId: 'order-1',
      flow: 'ad',
    });

    await expect(
      controller.handleKcpMobileReturn({
        ordr_idxx: 'order-1',
        res_cd: '0000',
        enc_data: 'd',
        enc_info: 'i',
      }),
    ).resolves.toEqual({ outcome: 'success', orderId: 'order-1', flow: 'ad' });
    expect(paymentsService.handleKcpMobileReturn).toHaveBeenCalledWith({
      ordr_idxx: 'order-1',
      res_cd: '0000',
      enc_data: 'd',
      enc_info: 'i',
    });
  });

  it('returns the failed outcome with the res code for the front fail page', async () => {
    const { controller, paymentsService } = createKcpController();
    paymentsService.handleKcpMobileReturn.mockResolvedValue({
      outcome: 'failed',
      orderId: 'order-1',
      flow: 'design',
      code: '3001',
    });

    await expect(controller.handleKcpMobileReturn({ res_cd: '3001' })).resolves.toEqual({
      outcome: 'failed',
      orderId: 'order-1',
      flow: 'design',
      code: '3001',
    });
  });
});

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

  it('applies the same webhook-grade throttle to the public KCP mobile return', () => {
    const handler = PaymentsController.prototype.handleKcpMobileReturn;
    expect(Reflect.getMetadata(THROTTLER_TTL + 'default', handler)).toBe(
      TOSS_WEBHOOK_THROTTLE.default.ttl,
    );
    expect(Reflect.getMetadata(THROTTLER_LIMIT + 'default', handler)).toBe(
      TOSS_WEBHOOK_THROTTLE.default.limit,
    );
  });
});
