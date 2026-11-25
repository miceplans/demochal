import 'reflect-metadata';
import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
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

describe('PaymentsController — PAYMENTS_ENABLED=false', () => {
  function createDisabledController() {
    const paymentsService = {
      confirmPayment: vi.fn(),
      registerKcpTransaction: vi.fn(),
      confirmKcpPayment: vi.fn(),
      handleKcpMobileReturn: vi.fn(),
      handleTossWebhook: vi.fn().mockResolvedValue(undefined),
    };
    const controller = new PaymentsController(paymentsService as unknown as PaymentsService);
    return { controller, paymentsService };
  }

  afterEach(() => {
    env.paymentsEnabled = true;
    env.tossPaymentsEnabled = false;
  });

  it('rejects new payment confirmations and registrations with 503 without calling the service', async () => {
    env.paymentsEnabled = false;
    const { controller, paymentsService } = createDisabledController();
    const user = { id: 'user-1' } as never;

    await expect(
      controller.confirm({ orderId: 'o', paymentKey: 'k', amount: 1000 } as never, user),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(
      controller.registerKcp({ orderId: 'o', orderName: 'n', flow: 'ad' }, user),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(
      controller.confirmKcp({ orderId: 'o', encData: 'e', encInfo: 'i' } as never, user),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(paymentsService.confirmPayment).not.toHaveBeenCalled();
    expect(paymentsService.registerKcpTransaction).not.toHaveBeenCalled();
    expect(paymentsService.confirmKcpPayment).not.toHaveBeenCalled();
  });

  it('opens only Toss confirmations when TOSS_PAYMENTS_ENABLED is true', async () => {
    env.paymentsEnabled = false;
    env.tossPaymentsEnabled = true;
    const { controller, paymentsService } = createDisabledController();
    const user = { id: 'user-1' } as never;
    const tossDto = { orderId: 'o', paymentKey: 'k', amount: 1000 } as never;

    await controller.confirm(tossDto, user);
    expect(paymentsService.confirmPayment).toHaveBeenCalledWith('user-1', tossDto);

    await expect(
      controller.confirm({ orderId: 'o', provider: 'naverpay', paymentId: 'p' } as never, user),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(
      controller.registerKcp({ orderId: 'o', orderName: 'n', flow: 'ad' }, user),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(
      controller.confirmKcp({ orderId: 'o', encData: 'e', encInfo: 'i' } as never, user),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(controller.handleKcpMobileReturn({})).resolves.toEqual({
      outcome: 'failed',
      code: 'payments_disabled',
    });
    expect(paymentsService.confirmPayment).toHaveBeenCalledTimes(1);
  });

  it('turns the public KCP mobile return into a failed outcome instead of approving', async () => {
    env.paymentsEnabled = false;
    const { controller, paymentsService } = createDisabledController();

    await expect(
      controller.handleKcpMobileReturn({
        res_cd: '0000',
        ordr_idxx: 'o',
        enc_data: 'e',
        enc_info: 'i',
      }),
    ).resolves.toEqual({ outcome: 'failed', code: 'payments_disabled' });
    expect(paymentsService.handleKcpMobileReturn).not.toHaveBeenCalled();
  });

  it('keeps processing Toss webhooks so already-paid orders still settle', async () => {
    env.paymentsEnabled = false;
    const { controller, paymentsService } = createDisabledController();

    await expect(
      controller.handleTossWebhook(payload, requestFrom('203.0.113.10')),
    ).resolves.toEqual({
      received: true,
    });
    expect(paymentsService.handleTossWebhook).toHaveBeenCalledWith(payload);
  });
});

describe('PaymentsController — production requires live credentials', () => {
  const original = {
    nodeEnv: env.nodeEnv,
    tossSecretKey: env.tossSecretKey,
    kcpProduction: env.kcpProduction,
  };
  const user = { id: 'user-1' } as never;
  const tossDto = { orderId: 'o', paymentKey: 'k', amount: 1000 } as never;
  const kcpDto = { orderId: 'o', encData: 'e', encInfo: 'i' } as never;

  function create() {
    const paymentsService = {
      confirmPayment: vi.fn(),
      registerKcpTransaction: vi.fn(),
      confirmKcpPayment: vi.fn(),
      handleKcpMobileReturn: vi.fn().mockResolvedValue({ outcome: 'success' }),
      handleTossWebhook: vi.fn().mockResolvedValue(undefined),
    };
    return {
      paymentsService,
      controller: new PaymentsController(paymentsService as unknown as PaymentsService),
    };
  }

  afterEach(() => {
    Object.assign(env, original, { paymentsEnabled: true, tossPaymentsEnabled: false });
  });

  it.each([
    ['PAYMENTS_ENABLED', true, false],
    ['TOSS_PAYMENTS_ENABLED', false, true],
  ])('rejects Toss test keys opened by %s', async (_label, paymentsEnabled, tossOnly) => {
    Object.assign(env, {
      nodeEnv: 'production',
      tossSecretKey: 'test_sk_x',
      paymentsEnabled,
      tossPaymentsEnabled: tossOnly,
    });
    const { controller, paymentsService } = create();

    await expect(controller.confirm(tossDto, user)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(paymentsService.confirmPayment).not.toHaveBeenCalled();
  });

  it('allows Toss live keys in production and test keys elsewhere', async () => {
    const { controller, paymentsService } = create();
    Object.assign(env, { nodeEnv: 'production', tossSecretKey: 'live_sk_x' });
    await controller.confirm(tossDto, user);
    Object.assign(env, { nodeEnv: 'development', tossSecretKey: 'test_sk_x' });
    await controller.confirm(tossDto, user);
    expect(paymentsService.confirmPayment).toHaveBeenCalledTimes(2);
  });

  it('blocks every KCP entry point in production test mode', async () => {
    Object.assign(env, { nodeEnv: 'production', kcpProduction: false, paymentsEnabled: true });
    const { controller, paymentsService } = create();

    await expect(
      controller.registerKcp({ orderId: 'o', orderName: 'n', flow: 'ad' }, user),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(controller.confirmKcp(kcpDto, user)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    await expect(controller.handleKcpMobileReturn({})).resolves.toEqual({
      outcome: 'failed',
      code: 'payments_disabled',
    });
    expect(paymentsService.confirmKcpPayment).not.toHaveBeenCalled();
    expect(paymentsService.handleKcpMobileReturn).not.toHaveBeenCalled();
  });

  it('allows KCP once it runs in production mode', async () => {
    Object.assign(env, { nodeEnv: 'production', kcpProduction: true, paymentsEnabled: true });
    const { controller, paymentsService } = create();
    await controller.confirmKcp(kcpDto, user);
    expect(paymentsService.confirmKcpPayment).toHaveBeenCalledTimes(1);
  });

  it('keeps settling webhooks regardless of the credentials', async () => {
    Object.assign(env, { nodeEnv: 'production', tossSecretKey: 'test_sk_x' });
    const { controller } = create();
    await expect(
      controller.handleTossWebhook(payload, requestFrom('203.0.113.10')),
    ).resolves.toEqual({ received: true });
  });
});
