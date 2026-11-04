import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@emotion/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { theme } from '@/styles/theme';
import { PaymentSuccessPage } from './PaymentSuccessPage';

const mocks = vi.hoisted(() => ({ confirm: vi.fn(), getOrder: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams('orderId=order-1&paymentKey=pay-key-1&amount=50000'),
}));
vi.mock('@semochal/api-client', () => ({ generated: { confirmPayment: mocks.confirm } }));
vi.mock('@/lib/ad-api', () => ({ adApi: { orders: { get: mocks.getOrder } } }));

const renderPage = () =>
  render(
    <ThemeProvider theme={theme}>
      <PaymentSuccessPage />
    </ThemeProvider>,
  );

describe('PaymentSuccessPage', () => {
  beforeEach(() => {
    window.history.pushState(
      {},
      '',
      '/payments/success?orderId=order-1&paymentKey=pay-key-1&amount=50000',
    );
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('shows the virtual account and stops polling while waiting for the deposit', async () => {
    mocks.confirm.mockResolvedValue({
      status: 200,
      data: {
        id: 'order-1',
        status: 'pending',
        virtualAccount: {
          bankCode: '088',
          accountNumber: 'X1234567890',
          dueDate: '2026-11-05T12:00:00+09:00',
        },
      },
    });
    renderPage();

    await waitFor(() => expect(screen.getByText('입금을 기다리고 있어요')).toBeTruthy());
    expect(screen.getByText('신한은행')).toBeTruthy();
    expect(screen.getByText('X1234567890')).toBeTruthy();
    expect(mocks.getOrder).not.toHaveBeenCalled();
  });

  it('polls the order and shows completion when the card payment is confirmed', async () => {
    mocks.confirm.mockResolvedValue({ status: 200, data: { id: 'order-1', status: 'paid' } });
    mocks.getOrder.mockResolvedValue({ id: 'order-1', status: 'paid' });
    renderPage();

    await waitFor(() => expect(screen.getByText('결제가 완료됐어요')).toBeTruthy());
  });
});
