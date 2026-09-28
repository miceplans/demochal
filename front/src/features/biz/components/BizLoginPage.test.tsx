import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, expect, it, beforeEach, afterEach } from 'vitest';
import type { ReactNode } from 'react';
import { BizLoginPage } from './BizLoginPage';

const mocks = vi.hoisted(() => {
  class MockApiError extends Error {
    constructor(readonly status: number) {
      super('API error');
    }
  }
  return {
    login: vi.fn(),
    logout: vi.fn(),
    replace: vi.fn(),
    toastError: vi.fn(),
    MockApiError,
  };
});

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: mocks.replace }) }));
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock('@/components/biz/BizShell', () => ({
  BizGlobalStyles: null,
  Logo: () => <div />,
  PrimaryButton: ({ children, ...props }: { children: ReactNode }) => (
    <button {...props}>{children}</button>
  ),
  useBizHref: () => (path: string) => `/biz${path}`,
}));
vi.mock('@/components/common/Toast', () => ({ useToast: () => ({ error: mocks.toastError }) }));
vi.mock('@semochal/api-client', () => ({
  ApiError: mocks.MockApiError,
  generated: { login: mocks.login, logout: mocks.logout },
}));

function renderLogin() {
  return render(<BizLoginPage />);
}

describe('BizLoginPage', () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs in with a username and redirects business accounts to the Biz dashboard', async () => {
    mocks.login.mockResolvedValue({ status: 200, data: { user: { role: 'business' } } });
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText('이메일 또는 아이디'), 'biz_owner');
    await user.type(screen.getByLabelText('비밀번호'), 'password123');
    await user.click(screen.getByRole('button', { name: '로그인' }));

    await waitFor(() =>
      expect(mocks.login).toHaveBeenCalledWith({ username: 'biz_owner', password: 'password123' }),
    );
    expect(mocks.replace).toHaveBeenCalledWith('/biz/dashboard');
  });

  it('clears a non-business session instead of entering the Biz console', async () => {
    mocks.login.mockResolvedValue({ status: 200, data: { user: { role: 'user' } } });
    mocks.logout.mockResolvedValue({ status: 204 });
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText('이메일 또는 아이디'), 'member@semochal.kr');
    await user.type(screen.getByLabelText('비밀번호'), 'password123');
    await user.click(screen.getByRole('button', { name: '로그인' }));

    await waitFor(() => expect(mocks.logout).toHaveBeenCalledOnce());
    expect(mocks.replace).not.toHaveBeenCalled();
  });
});
