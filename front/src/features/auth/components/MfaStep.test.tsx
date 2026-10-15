import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, expect, it, beforeEach, afterEach } from 'vitest';
import { MfaStep } from './MfaStep';
import type { MfaChallenge } from '../mfa-types';

const mocks = vi.hoisted(() => ({
  verifyMfaTotp: vi.fn(),
  verifyMfaRecoveryCode: vi.fn(),
  getMfaPasskeyAuthOptions: vi.fn(),
  verifyMfaPasskey: vi.fn(),
  setupMfaTotp: vi.fn(),
  confirmMfaTotp: vi.fn(),
  startAuthentication: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('@semochal/api-client', () => ({
  ApiError: class extends Error {},
  getApiErrorMessage: () => null,
  generated: {
    verifyMfaTotp: mocks.verifyMfaTotp,
    verifyMfaRecoveryCode: mocks.verifyMfaRecoveryCode,
    getMfaPasskeyAuthOptions: mocks.getMfaPasskeyAuthOptions,
    verifyMfaPasskey: mocks.verifyMfaPasskey,
    setupMfaTotp: mocks.setupMfaTotp,
    confirmMfaTotp: mocks.confirmMfaTotp,
  },
}));
vi.mock('@simplewebauthn/browser', () => ({
  startAuthentication: mocks.startAuthentication,
  startRegistration: vi.fn(),
}));
vi.mock('@/components/common/Toast', () => ({ useToast: () => ({ error: mocks.toastError }) }));

const adminUser = { id: 'u1', role: 'admin' } as MfaChallenge['user'];
const verifyChallenge = (methods: MfaChallenge['methods']): MfaChallenge => ({
  user: adminUser,
  mfaRequired: true,
  mfaEnrollmentRequired: false,
  mfaToken: 'tok',
  methods,
});
const enrollChallenge: MfaChallenge = {
  user: adminUser,
  mfaRequired: false,
  mfaEnrollmentRequired: true,
  mfaToken: 'enroll-tok',
  methods: [],
};

describe('MfaStep', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(cleanup);

  it('submits a TOTP code with the mfaToken and reports the authenticated user', async () => {
    mocks.verifyMfaTotp.mockResolvedValue({ status: 200, data: { user: adminUser } });
    const onAuthenticated = vi.fn();
    const user = userEvent.setup();
    render(
      <MfaStep
        challenge={verifyChallenge(['totp'])}
        onAuthenticated={onAuthenticated}
        onCancel={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText('인증 앱의 6자리 코드'), '123456');
    await user.click(screen.getByRole('button', { name: '인증' }));

    await waitFor(() => expect(onAuthenticated).toHaveBeenCalledWith(adminUser));
    expect(mocks.verifyMfaTotp).toHaveBeenCalledWith({ mfaToken: 'tok', code: '123456' });
  });

  it('lets the user choose among registered methods and use a recovery code', async () => {
    mocks.verifyMfaRecoveryCode.mockResolvedValue({ status: 200, data: { user: adminUser } });
    const onAuthenticated = vi.fn();
    const user = userEvent.setup();
    render(
      <MfaStep
        challenge={verifyChallenge(['totp', 'passkey'])}
        onAuthenticated={onAuthenticated}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByRole('tab', { name: '패스키' })).toBeTruthy();
    await user.click(screen.getByRole('tab', { name: '복구 코드' }));
    await user.type(screen.getByLabelText('복구 코드', { selector: 'input' }), 'AAAA-BBBB-CCCC');
    await user.click(screen.getByRole('button', { name: '인증' }));

    await waitFor(() => expect(onAuthenticated).toHaveBeenCalledWith(adminUser));
    expect(mocks.verifyMfaRecoveryCode).toHaveBeenCalledWith({
      mfaToken: 'tok',
      code: 'AAAA-BBBB-CCCC',
    });
  });

  it('authenticates with a passkey assertion', async () => {
    mocks.getMfaPasskeyAuthOptions.mockResolvedValue({
      status: 200,
      data: { options: { challenge: 'c' } },
    });
    mocks.startAuthentication.mockResolvedValue({ id: 'cred' });
    mocks.verifyMfaPasskey.mockResolvedValue({ status: 200, data: { user: adminUser } });
    const onAuthenticated = vi.fn();
    const user = userEvent.setup();
    render(
      <MfaStep
        challenge={verifyChallenge(['passkey'])}
        onAuthenticated={onAuthenticated}
        onCancel={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: '패스키로 인증' }));

    await waitFor(() => expect(onAuthenticated).toHaveBeenCalledWith(adminUser));
    expect(mocks.verifyMfaPasskey).toHaveBeenCalledWith({
      mfaToken: 'tok',
      credential: { id: 'cred' },
    });
  });

  it('shows an error toast and does not authenticate when the code is rejected', async () => {
    mocks.verifyMfaTotp.mockRejectedValue(new Error('bad'));
    const onAuthenticated = vi.fn();
    const user = userEvent.setup();
    render(
      <MfaStep
        challenge={verifyChallenge(['totp'])}
        onAuthenticated={onAuthenticated}
        onCancel={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText('인증 앱의 6자리 코드'), '000000');
    await user.click(screen.getByRole('button', { name: '인증' }));

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalled());
    expect(onAuthenticated).not.toHaveBeenCalled();
  });

  it('enrolls TOTP, shows recovery codes once and proceeds only after they are acknowledged', async () => {
    mocks.setupMfaTotp.mockResolvedValue({
      status: 200,
      data: { secret: 'JBSWY3DP', otpauthUrl: 'otpauth://totp/x' },
    });
    mocks.confirmMfaTotp.mockResolvedValue({
      status: 200,
      data: { recoveryCodes: ['AAAA-1111', 'BBBB-2222'] },
    });
    const onAuthenticated = vi.fn();
    const user = userEvent.setup();
    render(
      <MfaStep challenge={enrollChallenge} onAuthenticated={onAuthenticated} onCancel={vi.fn()} />,
    );

    await user.click(screen.getByRole('button', { name: '인증 앱(TOTP)으로 등록' }));
    expect(mocks.setupMfaTotp).toHaveBeenCalledWith({ mfaToken: 'enroll-tok' });
    await user.type(await screen.findByLabelText('6자리 코드'), '654321');
    await user.click(screen.getByRole('button', { name: '등록 완료' }));

    expect(await screen.findByText('AAAA-1111')).toBeTruthy();
    expect(mocks.confirmMfaTotp).toHaveBeenCalledWith({ mfaToken: 'enroll-tok', code: '654321' });
    const next = screen.getByRole('button', { name: '계속하기' }) as HTMLButtonElement;
    expect(next.disabled).toBe(true);
    expect(onAuthenticated).not.toHaveBeenCalled();

    await user.click(screen.getByRole('checkbox'));
    await user.click(next);
    expect(onAuthenticated).toHaveBeenCalledWith(adminUser);
  });
});
