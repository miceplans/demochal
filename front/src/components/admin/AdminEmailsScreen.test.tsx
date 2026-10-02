import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { AdminEmailsScreen } from './AdminEmailsScreen';

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  detail: vi.fn(),
  send: vi.fn(),
  create: vi.fn(),
}));

vi.mock('@semochal/api-client', () => ({
  adminEmailApi: {
    useListAdminEmails: mocks.list,
    useGetAdminEmail: mocks.detail,
    useSendAdminEmailReply: mocks.send,
    useCreateAdminEmail: mocks.create,
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
  SelectFilter: () => null,
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
  });

  it('renders a thread and its inbound timeline after selection', async () => {
    const user = userEvent.setup();
    render(<AdminEmailsScreen />);
    await user.click(screen.getByRole('button', { name: /문의/ }));
    expect(screen.getAllByText('도와주세요').length).toBeGreaterThan(1);
    expect(screen.getAllByText('customer@example.com').length).toBeGreaterThan(1);
  });

  it('keeps the draft when reply sending fails so it can be retried', async () => {
    mocks.send.mockReturnValue({
      isPending: false,
      isError: true,
      mutateAsync: vi.fn().mockRejectedValue(new Error('SES failed')),
    });
    const user = userEvent.setup();
    render(<AdminEmailsScreen />);
    await user.click(screen.getByRole('button', { name: /문의/ }));
    const textarea = screen.getByPlaceholderText('답장 내용을 입력하세요.');
    await user.type(textarea, '재시도할 답장');
    await user.click(screen.getByRole('button', { name: '답장 보내기' }));
    expect(textarea).toHaveProperty('value', '재시도할 답장');
  });

  it('renders the mailbox as a table and lets an admin compose a new email', async () => {
    const user = userEvent.setup();
    render(<AdminEmailsScreen />);
    expect(screen.getByRole('table')).toBeTruthy();
    expect(screen.queryByText('표시할 메일이 없어요.')).toBeNull();
    await user.click(screen.getByRole('button', { name: '새 메일 작성' }));
    await user.type(screen.getByPlaceholderText('받는 사람 이메일'), 'customer@example.com');
    await user.type(screen.getByPlaceholderText('제목'), '새 문의 답변');
    await user.type(screen.getByPlaceholderText('메일 내용을 입력하세요.'), '안녕하세요.');
    await user.click(screen.getByRole('button', { name: '메일 보내기' }));
    expect(mocks.create).toHaveBeenCalledWith({
      to: 'customer@example.com',
      subject: '새 문의 답변',
      text: '안녕하세요.',
    });
  });
});
