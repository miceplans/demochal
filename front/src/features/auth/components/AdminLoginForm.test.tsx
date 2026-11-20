import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@emotion/react';
import { vi, describe, expect, it, beforeEach, afterEach } from 'vitest';
import { theme } from '@/styles/theme';
import { AdminLoginForm } from './AdminLoginForm';

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  logout: vi.fn(),
  verifyMfaTotp: vi.fn(),
  verifyMfaRecoveryCode: vi.fn(),
  getMfaPasskeyAuthOptions: vi.fn(),
  verifyMfaPasskey: vi.fn(),
  setupMfaTotp: vi.fn(),
  confirmMfaTotp: vi.fn(),
  getMfaPasskeyRegisterOptions: vi.fn(),
  verifyMfaPasskeyRegistration: vi.fn(),
  startAuthentication: vi.fn(),
  startRegistration: vi.fn(),
  toDataURL: vi.fn(),
  push: vi.fn(),
  toastError: vi.fn(),
}));
const TEST_PASSWORD = 'placeholder-password';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock('@/components/common/Toast', () => ({ useToast: () => ({ error: mocks.toastError }) }));
vi.mock('@semochal/api-client', () => ({
  ApiError: class extends Error {},
  getApiErrorMessage: () => null,
  generated: {
    login: mocks.login,
    logout: mocks.logout,
    verifyMfaTotp: mocks.verifyMfaTotp,
    verifyMfaRecoveryCode: mocks.verifyMfaRecoveryCode,
    getMfaPasskeyAuthOptions: mocks.getMfaPasskeyAuthOptions,
    verifyMfaPasskey: mocks.verifyMfaPasskey,
    setupMfaTotp: mocks.setupMfaTotp,
    confirmMfaTotp: mocks.confirmMfaTotp,
    getMfaPasskeyRegisterOptions: mocks.getMfaPasskeyRegisterOptions,
    verifyMfaPasskeyRegistration: mocks.verifyMfaPasskeyRegistration,
  },
}));
vi.mock('@simplewebauthn/browser', () => ({
  startAuthentication: mocks.startAuthentication,
  startRegistration: mocks.startRegistration,
}));
vi.mock('qrcode', () => ({ toDataURL: mocks.toDataURL }));

function renderForm() {
  return render(
    <ThemeProvider theme={theme}>
      <AdminLoginForm />
    </ThemeProvider>,
  );
}

async function submitLogin(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('이메일'), 'admin@semochal.kr');
  await user.type(screen.getByLabelText('비밀번호'), TEST_PASSWORD);
  await user.click(screen.getByRole('button', { name: '로그인' }));
}

describe('AdminLoginForm', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(cleanup);

  it('redirects to /admin when an admin session is issued without MFA', async () => {
    mocks.login.mockResolvedValue({
      status: 200,
      data: { accessToken: 'session-token', user: { id: 'a1', role: 'admin' } },
    });
    const user = userEvent.setup();
    renderForm();

    await submitLogin(user);

    await waitFor(() =>
      expect(mocks.login).toHaveBeenCalledWith({
        email: 'admin@semochal.kr',
        password: TEST_PASSWORD,
      }),
    );
    expect(mocks.push).toHaveBeenCalledWith('/admin');
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it('renders the MFA step instead of redirecting when the login responds with an mfaToken', async () => {
    mocks.login.mockResolvedValue({
      status: 200,
      data: {
        user: { id: 'a1', role: 'admin' },
        mfaRequired: true,
        mfaEnrollmentRequired: false,
        mfaToken: 'mfa-token',
        methods: ['totp'],
      },
    });
    const user = userEvent.setup();
    renderForm();

    await submitLogin(user);

    expect(await screen.findByText('2단계 인증')).toBeTruthy();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it('logs out and shows an error toast when the post-MFA user is not an admin', async () => {
    mocks.login.mockResolvedValue({
      status: 200,
      data: {
        user: { id: 'a1', role: 'admin' },
        mfaRequired: true,
        mfaEnrollmentRequired: false,
        mfaToken: 'mfa-token',
        methods: ['totp'],
      },
    });
    // 2FA 검증 결과로 다른(일반) 계정이 돌아온 경우 — 세션 쿠키를 지우고 콘솔 진입을 막는다.
    mocks.verifyMfaTotp.mockResolvedValue({
      status: 200,
      data: { user: { id: 'u1', role: 'user' } },
    });
    mocks.logout.mockResolvedValue({ status: 204 });
    const user = userEvent.setup();
    renderForm();

    await submitLogin(user);
    await user.type(await screen.findByLabelText('인증 앱의 6자리 코드'), '123456');
    await user.click(screen.getByRole('button', { name: '인증' }));

    await waitFor(() => expect(mocks.logout).toHaveBeenCalledOnce());
    expect(mocks.toastError).toHaveBeenCalledWith('관리자 계정이 아닙니다.');
    expect(mocks.push).not.toHaveBeenCalled();
    // 거부 뒤에는 비밀번호 폼으로 돌아간다.
    expect(screen.getByRole('button', { name: '로그인' })).toBeTruthy();
  });

  it('shows an error toast when the login request fails', async () => {
    mocks.login.mockRejectedValue(new Error('bad credentials'));
    const user = userEvent.setup();
    renderForm();

    await submitLogin(user);

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledOnce());
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
