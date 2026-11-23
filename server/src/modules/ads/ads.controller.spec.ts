import { ServiceUnavailableException } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { env } from '../../config/env.js';
import type { BusinessesService } from '../businesses/businesses.service.js';
import { AdsController } from './ads.controller.js';
import type { AdsService } from './ads.service.js';

function createController() {
  const adsService = { create: vi.fn().mockResolvedValue({ id: 'ad-1' }) };
  const businessesService = { findByOwner: vi.fn().mockResolvedValue({ id: 'biz-1' }) };
  const controller = new AdsController(
    adsService as unknown as AdsService,
    businessesService as unknown as BusinessesService,
  );
  return { controller, adsService, businessesService };
}

const user = { id: 'user-1' } as never;
const dto = {
  productId: 'hero',
  startDate: '2026-10-26',
  endDate: '2026-10-26',
  expectedDailyPrice: 100_000,
};

describe('AdsController.create', () => {
  afterEach(() => {
    env.paymentsEnabled = true;
  });

  it('blocks ad product sales with 503 when payments are disabled', async () => {
    env.paymentsEnabled = false;
    const { controller, adsService, businessesService } = createController();

    await expect(controller.create(dto, user)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(businessesService.findByOwner).not.toHaveBeenCalled();
    expect(adsService.create).not.toHaveBeenCalled();
  });

  it('delegates to the service when payments are enabled', async () => {
    const { controller, adsService } = createController();

    await expect(controller.create(dto, user)).resolves.toEqual({ id: 'ad-1' });
    expect(adsService.create).toHaveBeenCalledWith(dto, 'biz-1', 'user-1');
  });
});
