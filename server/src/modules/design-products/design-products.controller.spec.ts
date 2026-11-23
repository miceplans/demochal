import 'reflect-metadata';
import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import throttlerConstants from '@nestjs/throttler/dist/throttler.constants.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { env } from '../../config/env.js';
import { DEFAULT_THROTTLE, DESIGN_ORDER_THROTTLE } from '../../common/throttling/throttling.js';
import type { BusinessesService } from '../businesses/businesses.service.js';
import { DesignProductsController } from './design-products.controller.js';
import type { DesignProductsService } from './design-products.service.js';

const { THROTTLER_LIMIT, THROTTLER_TTL } = throttlerConstants;

function createController(business: Record<string, unknown> | null) {
  const designProductsService = { createOrder: vi.fn().mockResolvedValue({ id: 'order-1' }) };
  const businessesService = { findByOwner: vi.fn().mockResolvedValue(business) };
  const controller = new DesignProductsController(
    designProductsService as unknown as DesignProductsService,
    businessesService as unknown as BusinessesService,
  );
  return { controller, designProductsService };
}

const user = { id: 'user-1' } as never;
const dto = { productCode: 'poster' } as const;

describe('DesignProductsController.createOrder', () => {
  afterEach(() => {
    env.paymentsEnabled = true;
  });

  it('blocks product sales with 503 when payments are disabled', async () => {
    env.paymentsEnabled = false;
    const { controller, designProductsService } = createController({
      id: 'biz-1',
      verificationStatus: 'verified',
    });

    await expect(controller.createOrder(dto, user)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(designProductsService.createOrder).not.toHaveBeenCalled();
  });

  it('rejects an authenticated user without a business with 403', async () => {
    const { controller, designProductsService } = createController(null);

    const error = await controller.createOrder(dto, user).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ForbiddenException);
    expect((error as ForbiddenException).getStatus()).toBe(403);
    expect(designProductsService.createOrder).not.toHaveBeenCalled();
  });

  it('rejects a business that is not verification-complete with 403', async () => {
    const { controller, designProductsService } = createController({
      id: 'biz-1',
      verificationStatus: 'pending',
    });

    const error = await controller.createOrder(dto, user).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ForbiddenException);
    expect((error as ForbiddenException).getStatus()).toBe(403);
    expect(designProductsService.createOrder).not.toHaveBeenCalled();
  });

  it('delegates to the service for a verified business', async () => {
    const { controller, designProductsService } = createController({
      id: 'biz-1',
      verificationStatus: 'verified',
    });

    await expect(controller.createOrder(dto, user)).resolves.toEqual({ id: 'order-1' });
    expect(designProductsService.createOrder).toHaveBeenCalledWith('poster', 'user-1');
  });

  it('carries a stricter per-route throttle than the global default', () => {
    // @nestjs/throttler stores per-throttler metadata on the handler function
    // (see its Throttle decorator); read it back to prove the decorator landed.
    const handler = DesignProductsController.prototype.createOrder;
    expect(Reflect.getMetadata(THROTTLER_TTL + 'default', handler)).toBe(
      DESIGN_ORDER_THROTTLE.default.ttl,
    );
    expect(Reflect.getMetadata(THROTTLER_LIMIT + 'default', handler)).toBe(
      DESIGN_ORDER_THROTTLE.default.limit,
    );
    expect(DESIGN_ORDER_THROTTLE.default.limit).toBeLessThan(DEFAULT_THROTTLE.limit);
  });
});
