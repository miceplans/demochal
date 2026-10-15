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
const TEST_PASSWORD = 'placeholder-password';

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
  getApiErrorMessage: () => null,
  generated: {
    login: mocks.login,
    logout: mocks.logout,
    verifyMfaTotp: vi.fn(),
    verifyMfaRecoveryCode: vi.fn(),
    getMfaPasskeyAuthOptions: vi.fn(),
    verifyMfaPasskey: vi.fn(),
    setupMfaTotp: vi.fn(),
    confirmMfaTotp: vi.fn(),
    getMfaPasskeyRegisterOptions: vi.fn(),
    verifyMfaPasskeyRegistration: vi.fn(),
  },
}));
vi.mock('@simplewebauthn/browser', () => ({
  startAuthentication: vi.fn(),
  startRegistration: vi.fn(),
}));
vi.mock('qrcode', () => ({ toDataURL: vi.fn() }));

function renderLogin() {
  return render(<BizLoginPage />);
}

describe('BizLoginPage', () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs in with an email and redirects business accounts to the Biz dashboard', async () => {
    mocks.login.mockResolvedValue({ status: 200, data: { user: { role: 'business' } } });
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText('이메일'), 'biz@semochal.kr');
    await user.type(screen.getByLabelText('비밀번호'), TEST_PASSWORD);
    await user.click(screen.getByRole('button', { name: '로그인' }));

    await waitFor(() =>
      expect(mocks.login).toHaveBeenCalledWith({
        email: 'biz@semochal.kr',
        password: TEST_PASSWORD,
      }),
    );
    expect(mocks.replace).toHaveBeenCalledWith('/biz/dashboard');
  });

  it('clears a non-business session instead of entering the Biz console', async () => {
    mocks.login.mockResolvedValue({ status: 200, data: { user: { role: 'user' } } });
    mocks.logout.mockResolvedValue({ status: 204 });
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText('이메일'), 'member@semochal.kr');
    await user.type(screen.getByLabelText('비밀번호'), TEST_PASSWORD);
    await user.click(screen.getByRole('button', { name: '로그인' }));

    await waitFor(() => expect(mocks.logout).toHaveBeenCalledOnce());
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  // TODO(2FA): 2단계 인증 임시 비활성화 — 재활성화 시 skip 제거.
  it.skip('moves to the second-factor step instead of entering the console when 2FA is required', async () => {
    mocks.login.mockResolvedValue({
      status: 200,
      data: {
        user: { role: 'business' },
        mfaRequired: true,
        mfaEnrollmentRequired: false,
        mfaToken: 'tok',
        methods: ['totp'],
      },
    });
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText('이메일'), 'biz@semochal.kr');
    await user.type(screen.getByLabelText('비밀번호'), TEST_PASSWORD);
    await user.click(screen.getByRole('button', { name: '로그인' }));

    expect(await screen.findByText('2단계 인증')).toBeTruthy();
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  // TODO(2FA): 2단계 인증 임시 비활성화 — 재활성화 시 skip 제거.
  it.skip('moves to the enrollment step when 2FA registration is required', async () => {
    mocks.login.mockResolvedValue({
      status: 200,
      data: {
        user: { role: 'business' },
        mfaRequired: false,
        mfaEnrollmentRequired: true,
        mfaToken: 'enroll-tok',
        methods: [],
      },
    });
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText('이메일'), 'biz@semochal.kr');
    await user.type(screen.getByLabelText('비밀번호'), TEST_PASSWORD);
    await user.click(screen.getByRole('button', { name: '로그인' }));

    expect(await screen.findByText('2단계 인증 등록')).toBeTruthy();
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  // TODO(2FA): 2단계 인증 임시 비활성화 — 재활성화 시 skip 제거.
  it.skip('rejects an MFA challenge issued for a non-business account', async () => {
    mocks.login.mockResolvedValue({
      status: 200,
      data: {
        user: { role: 'user' },
        mfaRequired: true,
        mfaEnrollmentRequired: false,
        mfaToken: 'stolen-tok',
        methods: ['totp'],
      },
    });
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText('이메일'), 'member@semochal.kr');
    await user.type(screen.getByLabelText('비밀번호'), TEST_PASSWORD);
    await user.click(screen.getByRole('button', { name: '로그인' }));

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledOnce());
    expect(mocks.toastError).toHaveBeenCalledWith('기업 계정의 이메일과 비밀번호를 확인해주세요.');
    // 2FA 단계로 넘어가지 않고 콘솔 진입도 없다. 이 분기는 세션 쿠키 발급 전이라 정리할 로그아웃도 없다.
    expect(screen.queryByText('2단계 인증')).toBeNull();
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(mocks.logout).not.toHaveBeenCalled();
  });
});
