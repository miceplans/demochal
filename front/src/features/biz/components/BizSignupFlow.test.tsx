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
    submitVerification: vi.fn(),
    replace: vi.fn(),
    push: vi.fn(),
    toastError: vi.fn(),
    toastSuccess: vi.fn(),
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
  useToast: () => ({ error: mocks.toastError, success: mocks.toastSuccess }),
}));
vi.mock('@semochal/api-client', () => ({
  ApiError: mocks.MockApiError,
  generated: {
    register: mocks.register,
    registerBusiness: mocks.registerBusiness,
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
    // 체크 아이콘 스케일 팝 시작값과 버튼 눌림 스케일 선언
    expect(styleText).toContain('scale(0.4)');
    expect(styleText).toContain('scale(0.96)');
  });

  async function advanceToBusinessInfo(user: ReturnType<typeof userEvent.setup>) {
    const agreementBoxes = document.querySelectorAll('input[type="checkbox"]');
    await user.click(agreementBoxes[0]!);
    await user.click(agreementBoxes[1]!);
    await user.click(screen.getByRole('button', { name: '다음' }));

    await user.type(document.querySelector('input[name="name"]')!, '기업 담당자');
    await user.type(document.querySelector('input[name="email"]')!, 'biz@semochal.kr');
    await user.type(document.querySelector('input[name="password"]')!, 'password123');
    await user.type(document.querySelector('input[name="passwordConfirm"]')!, 'password123');
    await user.click(screen.getByRole('button', { name: '다음' }));
  }

  async function fillOrgInfo(user: ReturnType<typeof userEvent.setup>) {
    await user.type(document.querySelector('input[name="orgName"]')!, '세모컴퍼니');
    await user.type(document.querySelector('input[name="orgPhone"]')!, '02-1234-5678');
    await user.type(document.querySelector('input[name="orgEmail"]')!, 'contact@semochal.kr');
  }

  it('redirects completed BIZ signup to the login page without a business-registration document or verification request', async () => {
    mocks.registerBusiness.mockResolvedValue({ data: { id: 'business-1' } });
    const user = userEvent.setup();
    renderSignup();

    await advanceToBusinessInfo(user);

    expect(screen.getByLabelText('기관 정보')).not.toBeNull();
    expect(document.querySelector('input[type="file"]')).toBeNull();
    await fillOrgInfo(user);
    await user.click(screen.getByRole('button', { name: '다음' }));

    await waitFor(() =>
      expect(mocks.registerBusiness).toHaveBeenCalledWith({
        type: '기업',
        name: '세모컴퍼니',
        phone: '02-1234-5678',
        email: 'contact@semochal.kr',
      }),
    );
    expect(mocks.submitVerification).not.toHaveBeenCalled();
    expect(mocks.replace).toHaveBeenCalledWith('/biz/login');
    expect(mocks.push).not.toHaveBeenCalled();
    expect(mocks.toastSuccess).toHaveBeenCalledWith('가입이 완료됐어요.');
  });

  it('requires the organization fields before registering', async () => {
    const user = userEvent.setup();
    renderSignup();

    await advanceToBusinessInfo(user);
    await user.click(screen.getByRole('button', { name: '다음' }));

    expect(mocks.toastError).toHaveBeenCalledWith('사명/단체명을 입력해주세요.');
    expect(mocks.register).not.toHaveBeenCalled();
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
    await setValue('password', 'password123');
    await setValue('passwordConfirm', 'password123');
    await user.click(screen.getByRole('button', { name: '다음' }));

    await fillOrgInfo(user);
    await user.click(screen.getByRole('button', { name: '다음' }));

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/biz/login'));
    expect(mocks.register).toHaveBeenCalledWith(
      expect.not.objectContaining({ username: expect.anything() }),
    );
  });
});
