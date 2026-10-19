import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, expect, it, beforeEach, afterEach } from 'vitest';
import { MfaSettingsCard } from './MfaSettingsCard';

const mocks = vi.hoisted(() => ({
  setupMfaTotp: vi.fn(),
  confirmMfaTotp: vi.fn(),
  getMfaPasskeyRegisterOptions: vi.fn(),
  deleteMfaTotp: vi.fn(),
  deleteMfaPasskey: vi.fn(),
  regenerateMfaRecoveryCodes: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock('@semochal/api-client', () => ({
  ApiError: class extends Error {},
  getApiErrorMessage: () => null,
  generated: {
    useGetMfaStatus: () => ({
      data: {
        status: 200,
        data: {
          totp: { status: 'unenrolled', verifiedAt: null },
          passkeys: [{ id: 'pk-1' }],
          recoveryCodesRemaining: 3,
        },
      },
    }),
    getGetMfaStatusQueryKey: () => ['mfa-status'],
    getGetAdminSettingsQueryKey: () => ['admin-settings'],
    setupMfaTotp: mocks.setupMfaTotp,
    confirmMfaTotp: mocks.confirmMfaTotp,
    getMfaPasskeyRegisterOptions: mocks.getMfaPasskeyRegisterOptions,
    deleteMfaTotp: mocks.deleteMfaTotp,
    deleteMfaPasskey: mocks.deleteMfaPasskey,
    regenerateMfaRecoveryCodes: mocks.regenerateMfaRecoveryCodes,
  },
}));
vi.mock('@simplewebauthn/browser', () => ({ startRegistration: vi.fn() }));
vi.mock('@/components/common/Toast', () => ({
  useToast: () => ({ error: mocks.toastError, success: mocks.toastSuccess }),
}));

function renderCard() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MfaSettingsCard />
    </QueryClientProvider>,
  );
}

describe('MfaSettingsCard', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(cleanup);

  it('asks for the password before starting TOTP enrollment and sends it', async () => {
    mocks.setupMfaTotp.mockResolvedValue({
      status: 200,
      data: { secret: 'seed', otpauthUrl: 'otpauth://totp/x' },
    });
    renderCard();

    await userEvent.click(screen.getByRole('button', { name: '등록' }));
    expect(mocks.setupMfaTotp).not.toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText('비밀번호 확인'), 'test-key-password');
    await userEvent.click(screen.getByRole('button', { name: '확인' }));

    await waitFor(() =>
      expect(mocks.setupMfaTotp).toHaveBeenCalledWith({ password: 'test-key-password' }),
    );
  });

  it('completes adding TOTP after password confirmation and shows the issued recovery codes', async () => {
    mocks.setupMfaTotp.mockResolvedValue({
      status: 200,
      data: { secret: 'seed', otpauthUrl: 'otpauth://totp/x' },
    });
    mocks.confirmMfaTotp.mockResolvedValue({
      status: 200,
      data: { recoveryCodes: ['AAAA-1111', 'BBBB-2222'] },
    });
    const invalidateSpy = vi.spyOn(QueryClient.prototype, 'invalidateQueries');
    renderCard();

    await userEvent.click(screen.getByRole('button', { name: '등록' }));
    await userEvent.type(screen.getByLabelText('비밀번호 확인'), 'test-key-password');
    await userEvent.click(screen.getByRole('button', { name: '확인' }));

    const codeInput = await screen.findByLabelText('6자리 코드');
    await userEvent.type(codeInput, '123456');
    await userEvent.click(screen.getByRole('button', { name: '등록 완료' }));

    expect(await screen.findByText('AAAA-1111')).toBeTruthy();
    expect(mocks.confirmMfaTotp).toHaveBeenCalledWith({ code: '123456' });
    expect(mocks.toastSuccess).toHaveBeenCalledWith('인증 앱을 등록했어요');
    expect(invalidateSpy).toHaveBeenCalled();
    invalidateSpy.mockRestore();
  });

  it('shows an error toast and skips the status refresh when passkey deletion is rejected', async () => {
    mocks.deleteMfaPasskey.mockRejectedValue(new Error('wrong password'));
    const invalidateSpy = vi.spyOn(QueryClient.prototype, 'invalidateQueries');
    renderCard();

    await userEvent.click(screen.getByRole('button', { name: '삭제' }));
    await userEvent.type(screen.getByLabelText('비밀번호 확인'), 'test-key-wrong-password');
    await userEvent.click(screen.getByRole('button', { name: '확인' }));

    await waitFor(() =>
      expect(mocks.deleteMfaPasskey).toHaveBeenCalledWith('pk-1', {
        password: 'test-key-wrong-password',
      }),
    );
    expect(mocks.toastError).toHaveBeenCalledOnce();
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(invalidateSpy).not.toHaveBeenCalled();
    invalidateSpy.mockRestore();
  });
});
