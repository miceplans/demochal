import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { ThemeProvider } from '@emotion/react';
import { theme } from '@/styles/theme';
import { BizInquiryForm } from './BizInquiryForm';

const mocks = vi.hoisted(() => {
  class MockApiError extends Error {
    constructor(readonly status: number) {
      super('API error');
    }
  }
  return {
    submitOperationsInquiry: vi.fn(),
    toastError: vi.fn(),
    toastSuccess: vi.fn(),
    MockApiError,
  };
});

vi.mock('@semochal/api-client', () => ({
  ApiError: mocks.MockApiError,
  getApiErrorMessage: (error: unknown) => (error instanceof Error ? error.message : undefined),
  generated: {
    submitOperationsInquiry: mocks.submitOperationsInquiry,
  },
}));
vi.mock('@/components/biz/BizShell', () => ({
  PrimaryButton: ({ children, ...props }: { children: ReactNode }) => (
    <button {...props}>{children}</button>
  ),
}));
vi.mock('@/components/common/Toast', () => ({
  useToast: () => ({ error: mocks.toastError, success: mocks.toastSuccess }),
}));

const DRAFT_KEY = 'semochal:form-draft:v1:biz-inquiry';

function renderForm() {
  return render(
    <ThemeProvider theme={theme}>
      <BizInquiryForm />
    </ThemeProvider>,
  );
}

function fillForm() {
  fireEvent.change(screen.getByLabelText('성함'), { target: { value: '홍길동' } });
  fireEvent.change(screen.getByLabelText('연락처'), { target: { value: '010-1234-5678' } });
  fireEvent.change(screen.getByLabelText('문의내용'), { target: { value: '견적이 궁금합니다.' } });
}

describe('BizInquiryForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('초안이 있으면 입력값을 복원한다', () => {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        value: { name: '홍길동', contact: '010-1234-5678', content: '견적이 궁금합니다.' },
        savedAt: Date.now(),
      }),
    );
    renderForm();

    expect((screen.getByLabelText('성함') as HTMLInputElement).value).toBe('홍길동');
    expect((screen.getByLabelText('연락처') as HTMLInputElement).value).toBe('010-1234-5678');
    expect((screen.getByLabelText('문의내용') as HTMLTextAreaElement).value).toBe(
      '견적이 궁금합니다.',
    );
  });

  it('서버 프리렌더는 초안이 있어도 pristine HTML을 만들고, 클라이언트에서 effect 후 복원된다', () => {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        value: { name: '홍길동', contact: '010-1234-5678', content: '견적이 궁금합니다.' },
        savedAt: Date.now(),
      }),
    );

    // 서버 프리렌더는 localStorage를 읽지 않으므로 hydration mismatch가 없어야 한다.
    const html = renderToString(
      <ThemeProvider theme={theme}>
        <BizInquiryForm />
      </ThemeProvider>,
    );
    expect(html).not.toContain('홍길동');
    expect(html).not.toContain('견적이 궁금합니다.');

    // 클라이언트 렌더에서는 마운트 effect 이후 초안이 적용된다.
    renderForm();
    expect((screen.getByLabelText('성함') as HTMLInputElement).value).toBe('홍길동');
    expect((screen.getByLabelText('문의내용') as HTMLTextAreaElement).value).toBe(
      '견적이 궁금합니다.',
    );
  });

  it('입력한 내용이 초안으로 저장된다', async () => {
    renderForm();

    fillForm();

    await waitFor(
      () => {
        const raw = localStorage.getItem(DRAFT_KEY);
        expect(raw).not.toBeNull();
        expect((JSON.parse(raw!) as { value: unknown }).value).toEqual({
          name: '홍길동',
          contact: '010-1234-5678',
          content: '견적이 궁금합니다.',
        });
      },
      { timeout: 2500 },
    );
  });

  it('전송에 성공하면 초안과 입력을 지운다', async () => {
    mocks.submitOperationsInquiry.mockResolvedValue({ status: 200, data: {} });
    const { container } = renderForm();

    fillForm();
    await waitFor(() => expect(localStorage.getItem(DRAFT_KEY)).not.toBeNull(), {
      timeout: 2500,
    });

    fireEvent.submit(container.querySelector('form')!);

    await waitFor(() =>
      expect(mocks.submitOperationsInquiry).toHaveBeenCalledWith({
        name: '홍길동',
        contact: '010-1234-5678',
        content: '견적이 궁금합니다.',
      }),
    );
    await waitFor(() => expect(localStorage.getItem(DRAFT_KEY)).toBeNull());
    expect((screen.getByLabelText('성함') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('문의내용') as HTMLTextAreaElement).value).toBe('');
  });

  it('전송에 실패하면 초안을 지우지 않는다', async () => {
    mocks.submitOperationsInquiry.mockRejectedValue(new mocks.MockApiError(500));
    const { container } = renderForm();

    fillForm();
    await waitFor(() => expect(localStorage.getItem(DRAFT_KEY)).not.toBeNull(), {
      timeout: 2500,
    });

    fireEvent.submit(container.querySelector('form')!);

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalled());
    expect(localStorage.getItem(DRAFT_KEY)).not.toBeNull();
  });

  it('빈 값으로 제출하면 전송하지 않고 필드 에러와 안내 메시지를 보여준다', async () => {
    const { container } = renderForm();

    fireEvent.submit(container.querySelector('form')!);

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        '입력 내용을 확인해주세요',
        '성함을 입력해주세요. 연락처를 입력해주세요. 문의 내용을 입력해주세요.',
      ),
    );
    expect(mocks.submitOperationsInquiry).not.toHaveBeenCalled();
    expect(screen.getByLabelText('성함').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByLabelText('연락처').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByLabelText('문의내용').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByRole('status').textContent).toBe(
      '성함을 입력해주세요. 연락처를 입력해주세요. 문의 내용을 입력해주세요.',
    );
  });

  it('입력을 고치면 해당 필드의 에러만 지워진다', async () => {
    const { container } = renderForm();
    fireEvent.submit(container.querySelector('form')!);
    await waitFor(() =>
      expect(screen.getByLabelText('성함').getAttribute('aria-invalid')).toBe('true'),
    );

    fireEvent.change(screen.getByLabelText('성함'), { target: { value: '홍길동' } });

    expect(screen.getByLabelText('성함').getAttribute('aria-invalid')).toBe('false');
    expect(screen.getByLabelText('연락처').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByLabelText('문의내용').getAttribute('aria-invalid')).toBe('true');
  });

  it('공백만 입력하면 필수 입력 에러를 보여준다', async () => {
    const { container } = renderForm();
    fireEvent.change(screen.getByLabelText('성함'), { target: { value: '   ' } });
    fireEvent.change(screen.getByLabelText('연락처'), { target: { value: '010-1234-5678' } });
    fireEvent.change(screen.getByLabelText('문의내용'), {
      target: { value: '견적이 궁금합니다.' },
    });

    fireEvent.submit(container.querySelector('form')!);

    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toBe('성함을 입력해주세요.'),
    );
    expect(mocks.submitOperationsInquiry).not.toHaveBeenCalled();
    expect(screen.getByLabelText('성함').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByLabelText('연락처').getAttribute('aria-invalid')).toBe('false');
    expect(screen.getByLabelText('문의내용').getAttribute('aria-invalid')).toBe('false');
  });

  it('최대 길이를 넘기면 길이 에러를 보여준다', async () => {
    const { container } = renderForm();
    fireEvent.change(screen.getByLabelText('성함'), { target: { value: '가'.repeat(101) } });
    fireEvent.change(screen.getByLabelText('연락처'), { target: { value: '010-1234-5678' } });
    fireEvent.change(screen.getByLabelText('문의내용'), {
      target: { value: '견적이 궁금합니다.' },
    });

    fireEvent.submit(container.querySelector('form')!);

    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toBe('성함은 100자 이내로 입력해주세요.'),
    );
    expect(mocks.submitOperationsInquiry).not.toHaveBeenCalled();
  });

  it('제출 시 앞뒤 공백을 제거한 값을 전송한다', async () => {
    mocks.submitOperationsInquiry.mockResolvedValue({ status: 200, data: {} });
    const { container } = renderForm();

    fireEvent.change(screen.getByLabelText('성함'), { target: { value: ' 홍길동 ' } });
    fireEvent.change(screen.getByLabelText('연락처'), { target: { value: ' 010-1234-5678' } });
    fireEvent.change(screen.getByLabelText('문의내용'), {
      target: { value: ' 견적이 궁금합니다. ' },
    });

    fireEvent.submit(container.querySelector('form')!);

    await waitFor(() =>
      expect(mocks.submitOperationsInquiry).toHaveBeenCalledWith({
        name: '홍길동',
        contact: '010-1234-5678',
        content: '견적이 궁금합니다.',
      }),
    );
  });
});
