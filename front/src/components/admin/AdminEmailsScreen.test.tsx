import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import {
  AdminEmailComposeScreen,
  AdminEmailThreadScreen,
  AdminEmailsScreen,
} from './AdminEmailsScreen';

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
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
    useGetAdminEmail: mocks.detail,
    useSendAdminEmailReply: mocks.send,
    useCreateAdminEmail: mocks.create,
    useUpdateAdminEmailStatus: mocks.updateStatus,
  },
}));

vi.mock('./parts', () => ({
  AdminTable: ({
    rows,
    onRowClick,
  }: {
    rows: Array<{ id: string; subject?: string; customerEmail?: string; lastMessage?: string }>;
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
    onChange,
  }: {
    label: string;
    value?: string;
    onChange?: (value: string) => void;
  }) => (
    <select aria-label={label} value={value} onChange={(event) => onChange?.(event.target.value)}>
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

  it('keeps the reply draft on the mail view page when sending fails', async () => {
    mocks.send.mockReturnValue({
      isPending: false,
      isError: true,
      mutateAsync: vi.fn().mockRejectedValue(new Error('SES failed')),
    });
    const user = userEvent.setup();
    render(<AdminEmailThreadScreen id="thread-1" />);
    const textarea = screen.getByPlaceholderText('답장 내용을 입력하세요.');
    await user.type(textarea, '재시도할 답장');
    await user.click(screen.getByRole('button', { name: '답장 보내기' }));
    expect(textarea).toHaveProperty('value', '재시도할 답장');
    await user.selectOptions(screen.getByRole('combobox', { name: '상태' }), '처리중');
    expect(mocks.updateStatus).toHaveBeenCalledWith({ id: 'thread-1', data: { status: 'pending' } });
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
