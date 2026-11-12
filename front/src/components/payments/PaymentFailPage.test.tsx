import { ThemeProvider } from '@emotion/react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PaymentFailPage } from './PaymentFailPage';
import { saveAdPaymentDraft } from '@/lib/ad-payment-draft';
import { theme } from '@/styles/theme';

const mocks = vi.hoisted(() => ({
  search: 'orderId=order-1&flow=ad',
  cancelOrder: vi.fn(),
  push: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push }),
  useSearchParams: () => new URLSearchParams(mocks.search),
}));

vi.mock('@/lib/ad-api', () => ({ adApi: { orders: { cancel: mocks.cancelOrder } } }));

describe('PaymentFailPage 광고 결제 재시도', () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.cancelOrder.mockReset();
    mocks.cancelOrder.mockResolvedValue({});
    mocks.push.mockReset();
  });

  afterEach(() => vi.clearAllMocks());

  it('광고 결제 실패 페이지가 draft를 보존하고 광고 관리로 돌아간다', async () => {
    saveAdPaymentDraft({
      placement: 'hero',
      imageFileId: 'file-1',
      title: '봄 이벤트',
      landingUrl: 'https://example.com',
    });
    render(
      <ThemeProvider theme={theme}>
        <PaymentFailPage />
      </ThemeProvider>,
    );

    await waitFor(() => expect(mocks.cancelOrder).toHaveBeenCalledWith('order-1'));
    expect(localStorage.getItem('semochal:biz-ad-payment-draft:v1')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '광고 관리로 이동' }));
    expect(mocks.push).toHaveBeenCalledWith('/biz/ads');
  });
});
