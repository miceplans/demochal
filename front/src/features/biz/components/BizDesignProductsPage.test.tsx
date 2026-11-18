import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BizDesignProductsPage } from './BizDesignProductsPage';

const mocks = vi.hoisted(() => ({
  createOrder: vi.fn(),
  cancelOrder: vi.fn(),
  requestPayment: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('@semochal/api-client', () => ({
  generated: {
    useListDesignProducts: () => ({
      isPending: false,
      data: {
        status: 200,
        data: [{ code: 'poster', name: '포스터', description: '포스터 디자인', price: 50000 }],
      },
    }),
    useCreateDesignProductOrder: () => ({ mutateAsync: mocks.createOrder }),
    useCancelOrder: () => ({ mutateAsync: mocks.cancelOrder }),
  },
}));

// bz 호스트 분기(네이버페이/토스)는 requestBizPayment가 맡는다 — 토스 직접 호출로 되돌아가면 안 된다.
vi.mock('@/lib/payments', () => ({ requestBizPayment: mocks.requestPayment }));

vi.mock('@/lib/api-error', () => ({
  apiErrorMessage: (_: unknown, fallback: string) => fallback,
}));

vi.mock('@/components/common/Toast', () => ({
  useToast: () => ({ success: vi.fn(), error: mocks.toastError }),
}));

vi.mock('@/components/biz/BizShell', () => ({
  BizContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SectionTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  PrimaryButton: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('BizDesignProductsPage', () => {
  it('구매 시 호스트 분기 결제 진입(requestBizPayment)으로 design flow 결제창을 연다', async () => {
    mocks.createOrder.mockResolvedValue({
      status: 201,
      data: { id: 'order-1', amount: 50000, name: '포스터' },
    });
    mocks.requestPayment.mockResolvedValue(true);

    render(<BizDesignProductsPage />);
    fireEvent.click(screen.getByRole('button', { name: '구매하기' }));

    await waitFor(() =>
      expect(mocks.requestPayment).toHaveBeenCalledWith({
        orderId: 'order-1',
        amount: 50000,
        orderName: '포스터',
        flow: 'design',
      }),
    );
    expect(mocks.cancelOrder).not.toHaveBeenCalled();
  });

  it('결제창을 열지 못하면 pending 주문을 취소한다', async () => {
    mocks.createOrder.mockResolvedValue({
      status: 201,
      data: { id: 'order-2', amount: 50000, name: '포스터' },
    });
    mocks.requestPayment.mockResolvedValue(false);
    mocks.cancelOrder.mockResolvedValue(undefined);

    render(<BizDesignProductsPage />);
    fireEvent.click(screen.getByRole('button', { name: '구매하기' }));

    await waitFor(() => expect(mocks.cancelOrder).toHaveBeenCalledWith({ id: 'order-2' }));
    expect(mocks.toastError).toHaveBeenCalled();
  });
});
