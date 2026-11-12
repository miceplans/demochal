import { afterEach, describe, expect, it } from 'vitest';
import {
  clearAdPaymentDraft,
  readAdPaymentDraft,
  saveAdPaymentDraft,
  type AdPaymentDraft,
} from './ad-payment-draft';

const draft: AdPaymentDraft = {
  placement: 'hero',
  imageFileId: 'file-1',
  title: '봄 이벤트',
  landingUrl: 'https://example.com',
};

describe('ad payment draft storage', () => {
  afterEach(() => localStorage.clear());

  it('stores and restores content needed for retry after payment redirect', () => {
    saveAdPaymentDraft(draft);

    expect(readAdPaymentDraft()).toEqual(draft);
  });

  it('ignores malformed drafts', () => {
    localStorage.setItem('semochal:biz-ad-payment-draft:v1', '{"placement":"hero"}');

    expect(readAdPaymentDraft()).toBeNull();
  });

  it('clears a completed payment draft', () => {
    saveAdPaymentDraft(draft);
    clearAdPaymentDraft();

    expect(readAdPaymentDraft()).toBeNull();
  });
});
