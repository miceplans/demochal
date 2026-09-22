import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { BillingController } from './billing.controller.js';
import type { BillingService } from './billing.service.js';
import type { BillingHistoryService } from './billing-history.service.js';
import type { BusinessesService } from '../businesses/businesses.service.js';

const user = { id: 'user-1', email: 'biz@semochal.kr', name: '사업자', role: 'business' };

function createController(business: { id: string } | null = { id: 'biz-1' }) {
  const billingService = {
    listCards: vi.fn().mockResolvedValue([]),
    registerCard: vi.fn(),
    getCustomerKey: vi.fn().mockReturnValue('semochal-biz-biz-1'),
    issueCard: vi.fn(),
  };
  const billingHistoryService = { forBusiness: vi.fn() };
  const businessesService = { findByOwner: vi.fn().mockResolvedValue(business) };
  const controller = new BillingController(
    billingService as unknown as BillingService,
    billingHistoryService as unknown as BillingHistoryService,
    businessesService as unknown as BusinessesService,
  );
  return { controller, billingService, businessesService };
}

describe('BillingController', () => {
  it('issues a card for the current business', async () => {
    const { controller, billingService } = createController();
    billingService.issueCard.mockResolvedValue({
      id: 'card-1',
      cardName: null,
      maskedNumber: '****-****-****-1234',
    });

    await expect(controller.issueCard({ authKey: 'auth-1' }, user)).resolves.toEqual({
      id: 'card-1',
      cardName: null,
      maskedNumber: '****-****-****-1234',
    });
    expect(billingService.issueCard).toHaveBeenCalledWith('biz-1', 'auth-1');
  });

  it('returns the billing customer key for the current business', async () => {
    const { controller, billingService } = createController();

    await expect(controller.getCustomerKey(user)).resolves.toEqual({
      customerKey: 'semochal-biz-biz-1',
    });
    expect(billingService.getCustomerKey).toHaveBeenCalledWith('biz-1');
  });

  it('forbids the billing endpoints without a business account', async () => {
    const { controller, billingService } = createController(null);

    await expect(controller.issueCard({ authKey: 'auth-1' }, user)).rejects.toThrow(
      ForbiddenException,
    );
    await expect(controller.getCustomerKey(user)).rejects.toThrow(ForbiddenException);
    await expect(controller.listCards(user)).rejects.toThrow(ForbiddenException);
    expect(billingService.issueCard).not.toHaveBeenCalled();
    expect(billingService.listCards).not.toHaveBeenCalled();
  });
});
