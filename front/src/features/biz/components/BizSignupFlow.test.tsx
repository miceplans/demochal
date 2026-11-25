import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
    findMyBusiness: vi.fn(),
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
  getApiErrorMessage: (error: unknown) => (error instanceof Error ? error.message : undefined),
  generated: {
    register: mocks.register,
    registerBusiness: mocks.registerBusiness,
    submitVerification: mocks.submitVerification,
    useFindMyBusiness: mocks.findMyBusiness,
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
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mocks.findMyBusiness.mockReturnValue({
      data: { status: 200, data: { id: 'old-business', type: '학교', name: '다른 기관' } },
    });
  });

  it('shows the existing-account login link', () => {
    renderSignup();

    expect(screen.getByText('이미 계정이 있나요?')).not.toBeNull();
    expect(screen.getByRole('link', { name: '로그인' }).getAttribute('href')).toBe('/biz/login');
  });

  it('renders the consent items as links to the BIZ legal pages', () => {
    renderSignup();

    expect(screen.getByRole('link', { name: '이용약관 동의' }).getAttribute('href')).toBe(
      '/biz/terms',
    );
    expect(screen.getByRole('link', { name: '개인정보처리방침 동의' }).getAttribute('href')).toBe(
      '/biz/privacy',
    );
  });

  it('does not toggle the checkbox when a consent link is clicked', async () => {
    const user = userEvent.setup();
    const { container } = renderSignup();

    await user.click(screen.getByRole('link', { name: '이용약관 동의' }));

    const box = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
    const next = screen.getByRole('button', { name: '다음' }) as HTMLButtonElement;
    expect(box.checked).toBe(false);
    expect(next.disabled).toBe(true);
  });

  it('keeps the next button disabled until all three agreements are checked', async () => {
    const user = userEvent.setup();
    const { container } = renderSignup();

    const agreementBoxes = container.querySelectorAll('input[type="checkbox"]');
    await user.click(agreementBoxes[0]);
    await user.click(agreementBoxes[1]);
    expect((screen.getByRole('button', { name: '다음' }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(agreementBoxes[2]);
    expect((screen.getByRole('button', { name: '다음' }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it('applies the BIZ landing reveal animation when entering the next step', async () => {
    const user = userEvent.setup();
    const { container } = renderSignup();

    const agreementBoxes = container.querySelectorAll('input[type="checkbox"]');
    await user.click(agreementBoxes[0]);
    await user.click(agreementBoxes[1]);
    await user.click(agreementBoxes[2]);
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
    await user.click(agreementBoxes[2]!);
    await user.click(screen.getByRole('button', { name: '다음' }));

    await user.type(document.querySelector('input[name="name"]')!, '기업 담당자');
    await user.type(document.querySelector('input[name="email"]')!, 'biz@semochal.kr');
    await user.type(document.querySelector('input[name="password"]')!, 'password123');
    await user.type(document.querySelector('input[name="passwordConfirm"]')!, 'password123');
    await user.click(screen.getByRole('button', { name: '다음' }));
  }

  async function fillOrgInfo(user: ReturnType<typeof userEvent.setup>) {
    await user.type(document.querySelector('input[name="orgName"]')!, '세모컴퍼니');
    await user.type(document.querySelector('input[name="orgRegistrationNumber"]')!, '6181234567');
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
        registrationNumber: '6181234567',
        phone: '02-1234-5678',
        email: 'contact@semochal.kr',
      }),
    );
    expect(mocks.submitVerification).not.toHaveBeenCalled();
    expect(mocks.register).toHaveBeenCalledWith(
      expect.objectContaining({ agreements: ['terms', 'privacy', 'business'] }),
    );
    expect(mocks.replace).toHaveBeenCalledWith('/biz/login');
    expect(mocks.push).not.toHaveBeenCalled();
    expect(mocks.toastSuccess).toHaveBeenCalledWith('가입이 완료됐어요.');
  });

  it.each([
    ['학교', '학교'],
    ['비영리 단체', '비영리'],
    ['협회', '협회'],
  ])('allows %s to register without a business number', async (label, type) => {
    mocks.registerBusiness.mockResolvedValue({ data: { id: 'business-1' } });
    const user = userEvent.setup();
    renderSignup();
    await advanceToBusinessInfo(user);
    await user.click(screen.getByRole('combobox', { name: '기관 유형' }));
    await user.click(screen.getByRole('option', { name: label }));
    await user.type(document.querySelector('input[name="orgName"]')!, '학교');
    await user.type(document.querySelector('input[name="orgPhone"]')!, '02-1234-5678');
    await user.type(document.querySelector('input[name="orgEmail"]')!, 'school@example.com');
    await user.click(screen.getByRole('button', { name: '다음' }));
    await waitFor(() =>
      expect(mocks.registerBusiness).toHaveBeenCalledWith(
        expect.objectContaining({ type, registrationNumber: undefined }),
      ),
    );
  });

  it('shows a warning after signup when the lookup was unavailable', async () => {
    mocks.registerBusiness.mockResolvedValue({
      data: { id: 'business-1', registrationLookupUnavailable: true },
    });
    const user = userEvent.setup();
    renderSignup();
    await advanceToBusinessInfo(user);
    await fillOrgInfo(user);
    await user.click(screen.getByRole('button', { name: '다음' }));
    await waitFor(() =>
      expect(mocks.toastSuccess).toHaveBeenCalledWith(
        expect.stringContaining('조회는 일시적으로 이용할 수 없었어요'),
      ),
    );
  });

  it('rejects a company without a complete number before creating an account', async () => {
    const user = userEvent.setup();
    renderSignup();
    await advanceToBusinessInfo(user);
    await user.type(document.querySelector('input[name="orgName"]')!, '기업');
    await user.click(screen.getByRole('button', { name: '다음' }));
    expect(mocks.toastError).toHaveBeenCalledWith('사업자 등록 번호 10자리를 입력해주세요.');
    expect(mocks.register).not.toHaveBeenCalled();
  });

  it('shows a rejected number and retries business registration without creating another account', async () => {
    mocks.registerBusiness
      .mockRejectedValueOnce(new Error('국세청에 등록되지 않은 사업자등록번호입니다.'))
      .mockResolvedValueOnce({ data: { id: 'business-1' } });
    const user = userEvent.setup();
    renderSignup();
    await advanceToBusinessInfo(user);
    await fillOrgInfo(user);
    await user.click(screen.getByRole('button', { name: '다음' }));
    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        '국세청에 등록되지 않은 사업자등록번호입니다.',
        expect.any(String),
      ),
    );
    await user.clear(document.querySelector('input[name="orgRegistrationNumber"]')!);
    await user.type(document.querySelector('input[name="orgRegistrationNumber"]')!, '9876543210');
    await user.click(screen.getByRole('button', { name: '다음' }));
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/biz/login'));
    expect(mocks.register).toHaveBeenCalledTimes(1);
    expect(mocks.registerBusiness).toHaveBeenLastCalledWith(
      expect.objectContaining({ registrationNumber: '9876543210' }),
    );
  });

  it('does not use an existing session business when registering a new account', async () => {
    mocks.registerBusiness.mockResolvedValue({ data: { id: 'new-business' } });
    const user = userEvent.setup();
    renderSignup();

    await advanceToBusinessInfo(user);
    expect(mocks.findMyBusiness).not.toHaveBeenCalled();
    for (const name of ['orgName', 'orgRegistrationNumber', 'orgPhone', 'orgEmail']) {
      const input = document.querySelector(`input[name="${name}"]`) as HTMLInputElement;
      expect(input.value).toBe('');
      expect(input.disabled).toBe(false);
    }
    const type = screen.getByRole('combobox', { name: '기관 유형' }) as HTMLButtonElement;
    expect(type.disabled).toBe(false);
    await user.click(type);
    await user.click(screen.getByRole('option', { name: '학교' }));
    await user.type(document.querySelector('input[name="orgName"]')!, '새 학교');
    await user.type(document.querySelector('input[name="orgPhone"]')!, '02-1234-5678');
    await user.type(document.querySelector('input[name="orgEmail"]')!, 'school@example.com');
    await user.click(screen.getByRole('button', { name: '다음' }));
    await waitFor(() =>
      expect(mocks.registerBusiness).toHaveBeenCalledWith(
        expect.objectContaining({ type: '학교', name: '새 학교' }),
      ),
    );
    expect(mocks.register).toHaveBeenCalledTimes(1);
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
    await user.click(agreementBoxes[2]);
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

  describe('form draft', () => {
    const DRAFT_KEY = 'semochal:form-draft:v1:biz-signup';

    it('restores typed account and org fields after unmount and remount', async () => {
      const user = userEvent.setup();
      const { unmount } = renderSignup();

      await advanceToBusinessInfo(user);
      await fillOrgInfo(user);
      await waitFor(() => expect(localStorage.getItem(DRAFT_KEY)).not.toBeNull(), {
        timeout: 2500,
      });
      unmount();

      renderSignup();

      // 마지막으로 머문 기관 단계와 입력값이 그대로 복원된다.
      expect(screen.getByLabelText('기관 정보')).not.toBeNull();
      expect((document.querySelector('input[name="orgName"]') as HTMLInputElement).value).toBe(
        '세모컴퍼니',
      );
      expect(
        (document.querySelector('input[name="orgRegistrationNumber"]') as HTMLInputElement).value,
      ).toBe('618-12-34567');
      expect((document.querySelector('input[name="orgPhone"]') as HTMLInputElement).value).toBe(
        '02-1234-5678',
      );
      expect((document.querySelector('input[name="orgEmail"]') as HTMLInputElement).value).toBe(
        'contact@semochal.kr',
      );

      // 이전 단계로 돌아가면 계정 이름·이메일도 복원되지만 비밀번호는 복원되지 않는다.
      await user.click(screen.getByRole('button', { name: '이전' }));
      expect((document.querySelector('input[name="name"]') as HTMLInputElement).value).toBe(
        '기업 담당자',
      );
      expect((document.querySelector('input[name="email"]') as HTMLInputElement).value).toBe(
        'biz@semochal.kr',
      );
      expect((document.querySelector('input[name="password"]') as HTMLInputElement).value).toBe('');
      expect(
        (document.querySelector('input[name="passwordConfirm"]') as HTMLInputElement).value,
      ).toBe('');
    });

    it('never writes password fields to localStorage', () => {
      vi.useFakeTimers();
      try {
        renderSignup();
        const agreementBoxes = document.querySelectorAll('input[type="checkbox"]');
        fireEvent.click(agreementBoxes[0]!);
        fireEvent.click(agreementBoxes[1]!);
        fireEvent.click(agreementBoxes[2]!);
        fireEvent.click(screen.getByRole('button', { name: '다음' }));

        fireEvent.change(document.querySelector('input[name="name"]')!, {
          target: { value: '기업 담당자' },
        });
        fireEvent.change(document.querySelector('input[name="email"]')!, {
          target: { value: 'biz@semochal.kr' },
        });
        fireEvent.change(document.querySelector('input[name="password"]')!, {
          target: { value: 'super-secret-1' },
        });
        fireEvent.change(document.querySelector('input[name="passwordConfirm"]')!, {
          target: { value: 'super-secret-1' },
        });
        act(() => {
          vi.advanceTimersByTime(600);
        });

        const raw = localStorage.getItem(DRAFT_KEY);
        expect(raw).not.toBeNull();
        expect(raw).not.toContain('super-secret-1');
        const draft = JSON.parse(raw!) as { value: Record<string, unknown> };
        // persisted 객체는 필드별로 화이트리스트만 담는다 — 비밀번호 필드가 아예 없어야 한다.
        expect(Object.keys(draft.value)).toEqual([
          'step',
          'agreed',
          'accountName',
          'accountEmail',
          'org',
          'orgType',
        ]);
        expect(draft.value).toMatchObject({
          step: 1,
          agreed: ['terms', 'privacy', 'business'],
          accountName: '기업 담당자',
          accountEmail: 'biz@semochal.kr',
        });
      } finally {
        vi.useRealTimers();
      }
    });

    it('clears the draft when registration fully succeeds', async () => {
      mocks.register.mockResolvedValue({ data: {} });
      mocks.registerBusiness.mockResolvedValue({ data: { id: 'business-1' } });
      const user = userEvent.setup();
      renderSignup();

      await advanceToBusinessInfo(user);
      await fillOrgInfo(user);
      await waitFor(() => expect(localStorage.getItem(DRAFT_KEY)).not.toBeNull(), {
        timeout: 2500,
      });

      await user.click(screen.getByRole('button', { name: '다음' }));

      await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/biz/login'));
      expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
    });

    it('keeps the draft cleared after success even when a debounced save was pending', async () => {
      mocks.register.mockResolvedValue({ data: {} });
      mocks.registerBusiness.mockResolvedValue({ data: { id: 'business-1' } });
      const user = userEvent.setup();
      renderSignup();

      await advanceToBusinessInfo(user);
      // 마지막 입력의 디바운스(500ms)가 끝나기 전에 바로 제출한다.
      await fillOrgInfo(user);
      await user.click(screen.getByRole('button', { name: '다음' }));

      await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/biz/login'));
      expect(localStorage.getItem(DRAFT_KEY)).toBeNull();

      // 디바운스 시간이 지나도 지워진 초안이 다시 생기지 않는다.
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 800));
      });
      expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
    });

    it('redirects a restored org-step draft to the account step when the password is missing', async () => {
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({
          value: {
            step: 2,
            agreed: ['terms', 'privacy', 'business'],
            accountName: '기업 담당자',
            accountEmail: 'biz@semochal.kr',
            org: {
              name: '세모컴퍼니',
              registrationNumber: '618-12-34567',
              phone: '02-1234-5678',
              email: 'contact@semochal.kr',
            },
            orgType: '기업',
          },
          savedAt: Date.now(),
        }),
      );
      const user = userEvent.setup();
      renderSignup();

      // 기관 단계가 복원되지만 비밀번호는 초안에 없으므로 제출 시 계정 단계로 안내한다.
      expect(screen.getByLabelText('기관 정보')).not.toBeNull();
      await user.click(screen.getByRole('button', { name: '다음' }));

      expect(mocks.toastError).toHaveBeenCalledWith('비밀번호는 8자 이상 입력해주세요.');
      expect(mocks.register).not.toHaveBeenCalled();
      expect(screen.getByLabelText('계정 정보')).not.toBeNull();
      expect((document.querySelector('input[name="email"]') as HTMLInputElement).value).toBe(
        'biz@semochal.kr',
      );
    });
  });
});
