import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BizProfilePage } from './BizProfilePage';

const mocks = vi.hoisted(() => ({ mutateAsync: vi.fn(), success: vi.fn(), error: vi.fn() }));
vi.mock('@semochal/api-client', () => ({
  ApiError: class ApiError extends Error {},
  getApiErrorMessage: () => null,
  generated: {
    useChangePassword: () => ({ mutateAsync: mocks.mutateAsync, isPending: false }),
    useGetMyAuthInfo: () => ({
      data: { status: 200, data: { name: '기업 담당자', email: 'biz@example.com' } },
    }),
    useFindMyBusiness: () => ({ data: { status: 200, data: { name: '예시 기업' } } }),
  },
}));
vi.mock('@/lib/ad-api', () => ({
  adApi: { files: { get: vi.fn().mockRejectedValue(new Error('missing')) } },
}));
vi.mock('@/components/biz/BizShell', () => ({
  BizContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PrimaryButton: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
  useBizHref: () => (path: string) => path,
}));
vi.mock('@/components/biz/BizOrgProfile', () => ({ BizOrgProfile: () => <div /> }));
vi.mock('@/components/common/Toast', () => ({
  useToast: () => ({ success: mocks.success, error: mocks.error }),
}));
vi.mock('@/components/common/Feedback', () => ({
  Modal: ({
    open,
    title,
    children,
  }: {
    open: boolean;
    title: string;
    children: React.ReactNode;
  }) => (open ? <section aria-label={title}>{children}</section> : null),
}));

describe('BizProfilePage password change', () => {
  afterEach(cleanup);
  beforeEach(() => vi.clearAllMocks());

  it('opens the form, submits the current and replacement passwords, and reports success', async () => {
    mocks.mutateAsync.mockResolvedValue({ status: 200, data: { changed: true } });
    const user = userEvent.setup();
    render(<BizProfilePage />);
    await user.click(screen.getByRole('button', { name: '재설정' }));
    await user.type(screen.getByLabelText('현재 비밀번호'), 'current-password');
    await user.type(
      screen.getByLabelText('새 비밀번호', { selector: 'input' }),
      'replacement-password',
    );
    await user.type(screen.getByLabelText('새 비밀번호 확인'), 'replacement-password');
    await user.click(screen.getByRole('button', { name: '변경하기' }));

    await waitFor(() =>
      expect(mocks.mutateAsync).toHaveBeenCalledWith({
        data: {
          currentPassword: 'current-password',
          newPassword: 'replacement-password',
          confirmNewPassword: 'replacement-password',
        },
      }),
    );
    expect(mocks.success).toHaveBeenCalledWith('비밀번호를 변경했습니다.');
    expect(mocks.error).not.toHaveBeenCalled();
  });

  it('does not submit when replacement password confirmation does not match', async () => {
    const user = userEvent.setup();
    render(<BizProfilePage />);
    await user.click(screen.getByRole('button', { name: '재설정' }));
    await user.type(screen.getByLabelText('현재 비밀번호'), 'current-password');
    fireEvent.change(screen.getByLabelText('새 비밀번호', { selector: 'input' }), {
      target: { value: 'replacement-password' },
    });
    await user.type(screen.getByLabelText('새 비밀번호 확인'), 'different-password');
    expect(screen.getByRole('alert').textContent).toContain('일치하지 않습니다');
    expect((screen.getByRole('button', { name: '변경하기' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
  });

  it('keeps the form open and shows a generic error when the API rejects the current password', async () => {
    mocks.mutateAsync.mockRejectedValue(new Error('unauthorized'));
    const user = userEvent.setup();
    render(<BizProfilePage />);
    await user.click(screen.getByRole('button', { name: '재설정' }));
    await user.type(screen.getByLabelText('현재 비밀번호'), 'incorrect-password');
    await user.type(
      screen.getByLabelText('새 비밀번호', { selector: 'input' }),
      'replacement-password',
    );
    await user.type(screen.getByLabelText('새 비밀번호 확인'), 'replacement-password');
    await user.click(screen.getByRole('button', { name: '변경하기' }));

    await waitFor(() =>
      expect(mocks.error).toHaveBeenCalledWith('현재 비밀번호를 확인하고 다시 시도해 주세요.'),
    );
    expect(screen.getByLabelText('비밀번호 변경')).toBeTruthy();
    expect((screen.getByLabelText('현재 비밀번호') as HTMLInputElement).value).toBe(
      'incorrect-password',
    );
    expect(mocks.success).not.toHaveBeenCalled();
  });
});
