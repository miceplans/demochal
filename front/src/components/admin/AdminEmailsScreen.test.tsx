import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import {
  AdminEmailComposeScreen,
  AdminEmailThreadScreen,
  AdminEmailsScreen,
} from './AdminEmailsScreen';

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  automated: vi.fn(),
  detail: vi.fn(),
  send: vi.fn(),
  create: vi.fn(),
  updateStatus: vi.fn(),
  push: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }));

vi.mock('@semochal/api-client', () => ({
  generated: {
    useListAdminEmails: mocks.list,
    useListAdminAutomatedEmails: mocks.automated,
    useGetAdminEmail: mocks.detail,
    useSendAdminEmailReply: mocks.send,
    useCreateAdminEmail: mocks.create,
    useUpdateAdminEmailStatus: mocks.updateStatus,
    getGetAdminEmailQueryKey: (id: string) => [`/admin/emails/${id}`],
    getListAdminEmailsQueryKey: () => ['/admin/emails'],
  },
}));

vi.mock('./parts', () => ({
  AdminTable: ({
    rows,
    onRowClick,
  }: {
    rows: Array<{
      id: string;
      subject?: string;
      customerEmail?: string;
      lastMessage?: string;
      recipient?: string;
    }>;
    columns?: unknown;
    selectedRowId?: string;
    onRowClick?: (row: {
      id: string;
      subject?: string;
      customerEmail?: string;
      lastMessage?: string;
    }) => void;
  }) => (
    <div role="table">
      {rows.map((row) => (
        <button key={row.id} type="button" onClick={() => onRowClick?.(row)}>
          <span>{row.subject}</span>
          <span>{row.customerEmail}</span>
          <span>{row.lastMessage}</span>
          <span>{row.recipient}</span>
        </button>
      ))}
    </div>
  ),
  AdminInlineNotice: ({ children, ...props }: { children: ReactNode }) => (
    <div {...props}>{children}</div>
  ),
  AdminPageTitle: ({ children }: { children: ReactNode }) => <h1>{children}</h1>,
  ApproveButton: ({ children, ...props }: { children: ReactNode }) => (
    <button {...props}>{children}</button>
  ),
  RejectButton: ({ children, ...props }: { children: ReactNode }) => (
    <button {...props}>{children}</button>
  ),
  FieldLabel: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  SelectFilter: ({
    label,
    value,
    disabled,
    onChange,
  }: {
    label: string;
    value?: string;
    disabled?: boolean;
    onChange?: (value: string) => void;
  }) => (
    <select
      aria-label={label}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange?.(event.target.value)}
    >
      <option value="">{label}</option>
      <option value="미처리">미처리</option>
      <option value="처리중">처리중</option>
      <option value="완료">완료</option>
    </select>
  ),
  StatCard: ({ label, value }: { label: string; value: string }) => (
    <div>
      {label}
      {value}
    </div>
  ),
  StatRow: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  FilterBar: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SearchFilter: ({
    value,
    onChange,
    label,
  }: {
    value?: string;
    onChange?: (value: string) => void;
    label: string;
  }) => (
    <input aria-label={label} value={value} onChange={(event) => onChange?.(event.target.value)} />
  ),
}));

type StatusVariables = { id: string; data: { status: 'open' | 'pending' | 'resolved' } };
type StatusContext = {
  previousDetail: unknown;
  previousLists: Array<[readonly unknown[], unknown]>;
};
type StatusMutationOptions = {
  mutation?: {
    onMutate?: (variables: StatusVariables) => Promise<StatusContext>;
    onError?: (error: Error, variables: StatusVariables, context: StatusContext) => void;
    onSuccess?: (
      response: { status: 200; data: { id: string; status: 'open' | 'pending' | 'resolved' } },
      variables: StatusVariables,
    ) => void;
  };
};

describe('AdminEmailsScreen', () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.list.mockReturnValue({
      data: {
        status: 200,
        data: [
          {
            id: 'thread-1',
            subject: '문의',
            customerEmail: 'customer@example.com',
            status: 'open',
            lastMessage: '도와주세요',
            lastMessageAt: '2026-10-02T00:00:00.000Z',
          },
        ],
      },
      isPending: false,
      isError: false,
    });
    mocks.automated.mockReturnValue({
      data: {
        status: 200,
        data: [
          {
            id: 'auto-1',
            subject: '[세모챌] 인증 결과 안내',
            type: 'verification.result',
            recipient: 'k***@gmail.com',
            textBody:
              '사업자 인증이 승인되었습니다.\n\n확인하기: https://semochall.com/notifications',
            status: 'sent',
            sentAt: '2026-10-02T00:00:00.000Z',
          },
        ],
      },
      isPending: false,
      isError: false,
      isSuccess: true,
    });
    mocks.detail.mockReturnValue({
      data: {
        status: 200,
        data: {
          id: 'thread-1',
          subject: '문의',
          customerEmail: 'customer@example.com',
          status: 'open',
          messages: [
            {
              id: 'message-1',
              direction: 'inbound',
              fromAddress: 'customer@example.com',
              messageId: 'root@example.com',
              textBody: '도와주세요',
              sentAt: '2026-10-02T00:00:00.000Z',
              references: [],
              attachments: [],
            },
          ],
        },
      },
      isPending: false,
    });
    mocks.send.mockReturnValue({ isPending: false, isError: false, mutateAsync: mocks.send });
    mocks.create.mockReturnValue({ isPending: false, isError: false, mutateAsync: mocks.create });
    mocks.updateStatus.mockReturnValue({ isPending: false, mutate: mocks.updateStatus });
  });

  it('renders a thread table and opens the mail view page when selected', async () => {
    const user = userEvent.setup();
    render(<AdminEmailsScreen />);
    await user.click(screen.getByRole('button', { name: /문의/ }));
    expect(mocks.push).toHaveBeenCalledWith('/admin/emails/thread-1');
  });

  it('filters the list with the status chips and shows counts', async () => {
    const user = userEvent.setup();
    render(<AdminEmailsScreen />);
    const chip = screen.getByRole('button', { name: /^미처리/ });
    expect(chip.textContent).toContain('1');
    await user.click(chip);
    expect(chip.getAttribute('aria-pressed')).toBe('true');
    expect(mocks.list).toHaveBeenCalledWith({ q: undefined, status: 'open' });
  });

  it('switches between help@ and no-reply@ mailboxes', async () => {
    const user = userEvent.setup();
    render(<AdminEmailsScreen />);
    expect(
      screen.getByRole('tab', { name: /help@semochall\.com/ }).getAttribute('aria-selected'),
    ).toBe('true');
    expect(screen.getByRole('button', { name: '+ 새 메일' })).toBeTruthy();
    await user.click(screen.getByRole('tab', { name: /no-reply@semochall\.com/ }));
    expect(screen.getByText('k***@gmail.com')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '+ 새 메일' })).toBeNull();
    expect(screen.queryByText('도와주세요')).toBeNull();
  });

  it('shows and hides the selected automated email text body', async () => {
    const user = userEvent.setup();
    render(<AdminEmailsScreen />);
    await user.click(screen.getByRole('tab', { name: /no-reply@semochall\.com/ }));
    const item = screen.getByRole('button', { name: /인증 결과 안내/ });
    expect(item.getAttribute('aria-expanded')).toBe('false');
    await user.click(item);
    expect(screen.getByText(/사업자 인증이 승인되었습니다/)).toBeTruthy();
    expect(item.getAttribute('aria-expanded')).toBe('true');
    await user.click(item);
    expect(screen.queryByText(/사업자 인증이 승인되었습니다/)).toBeNull();
  });

  it('shows the recipient and a Re: subject in the reply form', () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <AdminEmailThreadScreen id="thread-1" />
      </QueryClientProvider>,
    );
    expect(screen.getByLabelText('받는 사람')).toHaveProperty('value', 'customer@example.com');
    expect(screen.getByLabelText('답장 제목')).toHaveProperty('value', 'Re: 문의');
  });

  it('keeps the reply draft on the mail view page when sending fails', async () => {
    mocks.send.mockReturnValue({
      isPending: false,
      isError: true,
      mutateAsync: vi.fn().mockRejectedValue(new Error('SES failed')),
    });
    const user = userEvent.setup();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <AdminEmailThreadScreen id="thread-1" />
      </QueryClientProvider>,
    );
    const textarea = screen.getByPlaceholderText('답장 내용을 입력하세요.');
    await user.type(textarea, '재시도할 답장');
    await user.click(screen.getByRole('button', { name: '답장 보내기' }));
    expect(textarea).toHaveProperty('value', '재시도할 답장');
    await user.selectOptions(screen.getByRole('combobox', { name: '상태' }), '처리중');
    expect(mocks.updateStatus).toHaveBeenCalledWith({
      id: 'thread-1',
      data: { status: 'pending' },
    });
  });

  it('updates observed detail, list, and summary immediately, then restores both when status saving fails', async () => {
    let statusOptions: StatusMutationOptions | undefined;
    mocks.updateStatus.mockImplementation((options: StatusMutationOptions) => {
      statusOptions = options;
      return { isPending: false, isError: false, mutate: vi.fn() };
    });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const cachedList = {
      status: 200,
      data: [
        { id: 'thread-1', status: 'open' },
        { id: 'thread-2', status: 'resolved' },
      ],
    };
    const cachedDetail = { status: 200, data: { id: 'thread-1', status: 'open' } };
    queryClient.setQueryData(['/admin/emails/thread-1'], cachedDetail);
    queryClient.setQueryData(['/admin/emails'], cachedList);
    function EmailStatusCacheObserver() {
      const detail = useQuery({
        queryKey: ['/admin/emails/thread-1'],
        queryFn: async () => cachedDetail,
        enabled: false,
      });
      const list = useQuery({
        queryKey: ['/admin/emails'],
        queryFn: async () => cachedList,
        enabled: false,
      });
      const rows = list.data?.status === 200 ? list.data.data : [];
      return (
        <>
          <output data-testid="detail-status">{detail.data?.data.status}</output>
          <output data-testid="row-status">{rows[0]?.status}</output>
          <output data-testid="open-count">
            {rows.filter((row) => row.status === 'open').length}
          </output>
          <output data-testid="pending-count">
            {rows.filter((row) => row.status === 'pending').length}
          </output>
        </>
      );
    }
    render(
      <QueryClientProvider client={queryClient}>
        <AdminEmailThreadScreen id="thread-1" />
        <EmailStatusCacheObserver />
      </QueryClientProvider>,
    );

    let context: StatusContext | undefined;
    await act(async () => {
      context = await statusOptions?.mutation?.onMutate?.({
        id: 'thread-1',
        data: { status: 'pending' },
      });
    });

    expect(queryClient.getQueryData(['/admin/emails/thread-1'])).toEqual({
      status: 200,
      data: { id: 'thread-1', status: 'pending' },
    });
    expect(queryClient.getQueryData(['/admin/emails'])).toEqual({
      status: 200,
      data: [
        { id: 'thread-1', status: 'pending' },
        { id: 'thread-2', status: 'resolved' },
      ],
    });
    await waitFor(() => {
      expect(screen.getByTestId('detail-status').textContent).toBe('pending');
      expect(screen.getByTestId('row-status').textContent).toBe('pending');
      expect(screen.getByTestId('open-count').textContent).toBe('0');
      expect(screen.getByTestId('pending-count').textContent).toBe('1');
    });

    act(() => {
      statusOptions?.mutation?.onSuccess?.(
        { status: 200, data: { id: 'thread-1', status: 'resolved' } },
        { id: 'thread-1', data: { status: 'pending' } },
      );
    });
    await waitFor(() => {
      expect(screen.getByTestId('detail-status').textContent).toBe('resolved');
      expect(screen.getByTestId('row-status').textContent).toBe('resolved');
      expect(screen.getByTestId('pending-count').textContent).toBe('0');
    });

    act(() => {
      statusOptions?.mutation?.onError?.(
        new Error('save failed'),
        { id: 'thread-1', data: { status: 'pending' } },
        context!,
      );
    });
    expect(queryClient.getQueryData(['/admin/emails/thread-1'])).toEqual(cachedDetail);
    expect(queryClient.getQueryData(['/admin/emails'])).toEqual(cachedList);
  });

  it('blocks another status selection while saving and shows an error after a failed update', () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    mocks.updateStatus.mockReturnValue({ isPending: true, isError: true, mutate: vi.fn() });
    render(
      <QueryClientProvider client={queryClient}>
        <AdminEmailThreadScreen id="thread-1" />
      </QueryClientProvider>,
    );
    expect(screen.getByRole('combobox', { name: '상태' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('alert').textContent).toContain('상태를 변경하지 못했어요');
  });

  it('renders a separate compose page and sends a new email', async () => {
    const user = userEvent.setup();
    mocks.create.mockReturnValue({
      isPending: false,
      isError: false,
      mutateAsync: vi.fn().mockResolvedValue({ status: 201 }),
    });
    render(<AdminEmailComposeScreen />);
    expect(screen.getByRole('heading', { name: '새 메일 작성' })).toBeTruthy();
    await user.type(screen.getByPlaceholderText('customer@example.com'), 'customer@example.com');
    await user.type(screen.getByPlaceholderText('문의 답변을 입력하세요'), '새 문의 답변');
    await user.type(screen.getByPlaceholderText('메일 내용을 입력하세요.'), '안녕하세요.');
    await user.click(screen.getByRole('button', { name: '메일 보내기' }));
    expect(mocks.create.mock.results[0]?.value.mutateAsync).toHaveBeenCalledWith({
      data: {
        to: 'customer@example.com',
        subject: '새 문의 답변',
        text: '안녕하세요.',
      },
    });
  });
});
