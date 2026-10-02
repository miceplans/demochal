import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { AdminEmailsScreen } from './AdminEmailsScreen';

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  detail: vi.fn(),
  send: vi.fn(),
}));

vi.mock('@semochal/api-client', () => ({
  adminEmailApi: {
    useListAdminEmails: mocks.list,
    useGetAdminEmail: mocks.detail,
    useSendAdminEmailReply: mocks.send,
  },
}));

vi.mock('./parts', () => ({
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
});
