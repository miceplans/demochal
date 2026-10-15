import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, expect, it, beforeEach, afterEach } from 'vitest';
import type { ReactNode } from 'react';
import { ThemeProvider } from '@emotion/react';
import { theme } from '@/styles/theme';
import { BizSignupFlow } from './BizLoginFlow';

const mocks = vi.hoisted(() => {
  class MockApiError extends Error {
    constructor(readonly status: number) {
      super('API error');
    }
  }
  return {
    register: vi.fn(),
    registerBusiness: vi.fn(),
    requestPresignedUpload: vi.fn(),
    submitVerification: vi.fn(),
    replace: vi.fn(),
    push: vi.fn(),
    toastError: vi.fn(),
    MockApiError,
  };
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace, push: mocks.push }),
}));
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
  OutlineButton: ({ children, ...props }: { children: ReactNode }) => (
    <button {...props}>{children}</button>
  ),
  useBizHref: () => (path: string) => `/biz${path}`,
}));
vi.mock('@/components/common/Toast', () => ({
  useToast: () => ({ error: mocks.toastError, success: vi.fn() }),
}));
vi.mock('@semochal/api-client', () => ({
  ApiError: mocks.MockApiError,
  generated: {
    register: mocks.register,
    registerBusiness: mocks.registerBusiness,
    requestPresignedUpload: mocks.requestPresignedUpload,
    submitVerification: mocks.submitVerification,
  },
}));

function renderSignup() {
  return render(
    <ThemeProvider theme={theme}>
      <BizSignupFlow />
    </ThemeProvider>,
  );
}

describe('BizSignupFlow', () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the existing-account login link', () => {
    renderSignup();

    expect(screen.getByText('이미 계정이 있나요?')).not.toBeNull();
    expect(screen.getByRole('link', { name: '로그인' }).getAttribute('href')).toBe('/biz/login');
  });

  it('applies the BIZ landing reveal animation when entering the next step', async () => {
    const user = userEvent.setup();
    const { container } = renderSignup();

    const agreementBoxes = container.querySelectorAll('input[type="checkbox"]');
    await user.click(agreementBoxes[0]);
    await user.click(agreementBoxes[1]);
    await user.click(screen.getByRole('button', { name: '다음' }));

    expect(screen.getByText('성함을 입력해주세요')).not.toBeNull();
    const styleText = Array.from(document.querySelectorAll('style'))
      .map((s) => s.textContent ?? '')
      .join('\n');
    expect(styleText).toContain('semo-biz-step-in');
    expect(styleText).toContain('cubic-bezier(0.22, 1, 0.36, 1)');
    expect(styleText).toContain('prefers-reduced-motion');
  });

  it('injects micro-interaction styles for checkboxes and action buttons', () => {
    renderSignup();

    const styleText = Array.from(document.querySelectorAll('style'))
      .map((s) => s.textContent ?? '')
      .join('\n');
    // 체크 아이콘 스케일 팝 시작값/버튼 눌림 스케일/박스 테두리 전환 선언
    expect(styleText).toContain('scale(0.4)');
    expect(styleText).toContain('scale(0.96)');
    expect(styleText).toContain('border-color 150ms ease');
  });

  it('redirects a duplicate signup to the Biz login page', async () => {
    mocks.register.mockRejectedValue(new mocks.MockApiError(409));
    const user = userEvent.setup();
    const { container } = renderSignup();

    const agreementBoxes = container.querySelectorAll('input[type="checkbox"]');
    await user.click(agreementBoxes[0]);
    await user.click(agreementBoxes[1]);
    await user.click(screen.getByRole('button', { name: '다음' }));

    const setValue = async (name: string, value: string) => {
      const input = container.querySelector(`input[name="${name}"]`) as HTMLInputElement;
      await user.type(input, value);
    };
    await setValue('name', '기업 담당자');
    await setValue('email', 'biz@semochal.kr');
    await setValue('username', 'biz_owner');
    await setValue('password', 'password123');
    await setValue('passwordConfirm', 'password123');
    await user.click(screen.getByRole('button', { name: '다음' }));

    await user.click(screen.getByRole('button', { name: '다음' }));

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/biz/login'));
  });

  it('completes signup without any document upload or verification request', async () => {
    mocks.register.mockResolvedValue({});
    mocks.registerBusiness.mockResolvedValue({ data: { id: 'biz-1' } });
    const user = userEvent.setup();
    const { container } = renderSignup();

    const agreementBoxes = container.querySelectorAll('input[type="checkbox"]');
    await user.click(agreementBoxes[0]);
    await user.click(agreementBoxes[1]);
    await user.click(screen.getByRole('button', { name: '다음' }));

    for (const [name, value] of [
      ['name', '기업 담당자'],
      ['email', 'biz@semochal.kr'],
      ['username', 'biz_owner'],
      ['password', 'password123'],
      ['passwordConfirm', 'password123'],
    ]) {
      await user.type(container.querySelector(`input[name="${name}"]`) as HTMLInputElement, value);
    }
    await user.click(screen.getByRole('button', { name: '다음' }));

    expect(container.querySelector('input[type="file"]')).toBeNull();
    await user.click(screen.getByRole('button', { name: '다음' }));

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/biz/dashboard'));
    expect(mocks.registerBusiness).toHaveBeenCalledWith({ type: '기업' });
    expect(mocks.requestPresignedUpload).not.toHaveBeenCalled();
    expect(mocks.submitVerification).not.toHaveBeenCalled();
  });
});
