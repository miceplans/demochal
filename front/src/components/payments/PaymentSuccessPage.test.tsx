import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PaymentSuccessPage } from './PaymentSuccessPage';
import { saveAdPaymentDraft } from '@/lib/ad-payment-draft';
import { ThemeProvider } from '@emotion/react';
import { theme } from '@/styles/theme';

const mocks = vi.hoisted(() => ({
  search: '',
  getOrder: vi.fn(),
  confirmPayment: vi.fn(),
  push: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push }),
  useSearchParams: () => new URLSearchParams(mocks.search),
}));

vi.mock('@/lib/ad-api', () => ({
  adApi: {
    orders: { get: mocks.getOrder },
    payments: { confirm: mocks.confirmPayment },
  },
}));

const draft = {
  placement: 'hero' as const,
  imageFileId: 'file-1',
  title: '봄 이벤트',
  landingUrl: 'https://example.com',
};

describe('PaymentSuccessPage 광고 draft 정리', () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.search = 'orderId=order-1&paymentKey=pay-1&amount=100&flow=ad';
    mocks.getOrder.mockReset();
    mocks.confirmPayment.mockReset();
    mocks.confirmPayment.mockResolvedValue({});
    mocks.push.mockReset();
  });

  afterEach(() => cleanup());

  it('광고 결제가 paid가 되면 retry draft를 삭제한다', async () => {
    saveAdPaymentDraft(draft);
    mocks.getOrder.mockResolvedValue({ status: 'paid' });

    render(
      <ThemeProvider theme={theme}>
        <PaymentSuccessPage />
      </ThemeProvider>,
    );

    await waitFor(() => expect(screen.getByText('광고 계약이 확정됐어요.')).toBeTruthy());
    expect(localStorage.getItem('semochal:biz-ad-payment-draft:v1')).toBeNull();
  });

  it('광고 결제가 canceled면 retry draft를 보존한다', async () => {
    saveAdPaymentDraft(draft);
    mocks.getOrder.mockResolvedValue({ status: 'canceled' });

    render(
      <ThemeProvider theme={theme}>
        <PaymentSuccessPage />
      </ThemeProvider>,
    );

    await waitFor(() => expect(screen.getByText('결제를 완료하지 못했어요')).toBeTruthy());
    expect(localStorage.getItem('semochal:biz-ad-payment-draft:v1')).not.toBeNull();
  });

  it('비광고 결제가 paid가 되어도 광고 draft는 삭제하지 않는다', async () => {
    saveAdPaymentDraft(draft);
    mocks.search = 'orderId=order-1&paymentKey=pay-1&amount=100';
    mocks.getOrder.mockResolvedValue({ status: 'paid' });

    render(
      <ThemeProvider theme={theme}>
        <PaymentSuccessPage />
      </ThemeProvider>,
    );

    await waitFor(() => expect(screen.getByText('결제가 완료됐어요')).toBeTruthy());
    expect(localStorage.getItem('semochal:biz-ad-payment-draft:v1')).not.toBeNull();
  });
});
