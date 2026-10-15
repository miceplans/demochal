import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, expect, it, beforeEach, afterEach } from 'vitest';
import { MfaSettingsCard } from './MfaSettingsCard';

const mocks = vi.hoisted(() => ({
  setupMfaTotp: vi.fn(),
  getMfaPasskeyRegisterOptions: vi.fn(),
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
    getMfaPasskeyRegisterOptions: mocks.getMfaPasskeyRegisterOptions,
  },
}));
vi.mock('@simplewebauthn/browser', () => ({ startRegistration: vi.fn() }));
vi.mock('@/components/common/Toast', () => ({
  useToast: () => ({ error: vi.fn(), success: vi.fn() }),
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

    await userEvent.type(screen.getByLabelText('비밀번호 확인'), 'my-password');
    await userEvent.click(screen.getByRole('button', { name: '확인' }));

    await waitFor(() =>
      expect(mocks.setupMfaTotp).toHaveBeenCalledWith({ password: 'my-password' }),
    );
  });
});
