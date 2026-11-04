import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@emotion/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { theme } from '@/styles/theme';
import { ToastProvider } from '@/components/common/Toast';
import { AdminRefundsScreen } from './AdminRefundsScreen';

const approve = vi.fn();
const reject = vi.fn();
const listHook = vi.fn();

vi.mock('@semochal/api-client', () => ({
  generated: {
    useListAdminRefundRequests: (params: unknown) => listHook(params),
    useApproveRefundRequest: () => ({ isPending: false, mutate: approve }),
    useRejectRefundRequest: () => ({ isPending: false, mutate: reject }),
    getListAdminRefundRequestsQueryKey: () => ['refunds'],
  },
}));

const request = {
  id: 'req-1',
  orderId: 'order-1',
  status: 'requested',
  reason: '단순 변심',
  createdAt: '2026-11-01T00:00:00.000Z',
  amount: 50000,
  refundableAmount: 40000,
  orderType: 'ad',
  requesterName: '김수아',
  requesterEmail: 'su***@example.com',
};

function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider theme={theme}>
        <ToastProvider>
          <AdminRefundsScreen />
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

describe('AdminRefundsScreen', () => {
  beforeEach(() => {
    listHook.mockReturnValue({ data: { data: [request] }, isPending: false, isError: false });
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('asks for confirmation before approving, then approves the request', () => {
    renderScreen();
    expect(screen.getByText('단순 변심')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '승인' }));
    expect(approve).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '승인하고 결제 취소' }));
    expect(approve).toHaveBeenCalledWith({ id: 'req-1' });
  });

  it('requires a reason to reject and sends it to the buyer', () => {
    renderScreen();
    fireEvent.click(screen.getByRole('button', { name: '반려', hidden: false }));
    const submit = screen.getAllByRole('button', { name: '반려' }).at(-1)!;
    expect((submit as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('반려 사유'), { target: { value: ' 기간 경과 ' } });
    fireEvent.click(screen.getAllByRole('button', { name: '반려' }).at(-1)!);
    expect(reject).toHaveBeenCalledWith({ id: 'req-1', data: { reason: '기간 경과' } });
  });

  it('hides actions for already processed requests', () => {
    listHook.mockReturnValue({
      data: { data: [{ ...request, status: 'approved' }] },
      isPending: false,
      isError: false,
    });
    renderScreen();
    expect(screen.queryByRole('button', { name: '승인' })).toBeNull();
  });
});
