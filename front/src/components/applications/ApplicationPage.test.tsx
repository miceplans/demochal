import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FormEventHandler, ReactNode } from 'react';
import { ApplicationPage } from './ApplicationPage';
import { ThemeProvider } from '@emotion/react';
import { theme } from '@/styles/theme';
import type { Question } from './ApplicationQuestions';
import { NETWORK_ERROR_MESSAGE } from '@/lib/api-error';
import { ApiError } from '@semochal/api-client';

const mocks = vi.hoisted(() => ({
  apply: vi.fn(),
  presign: vi.fn(),
  finalize: vi.fn(),
  upload: vi.fn(),
  push: vi.fn(),
  save: vi.fn(),
  clear: vi.fn(),
  error: vi.fn(),
  success: vi.fn(),
  pay: vi.fn(),
  questions: [] as Question[],
  failed: false,
  draft: null as { challengeId?: string; answers?: Record<string, string | string[]> } | null,
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push }),
  useSearchParams: () => new URLSearchParams('challenge=challenge-1'),
}));
vi.mock('@/components/common/UserShell', () => ({
  UserShell: ({ children }: { children: ReactNode }) => (
    <ThemeProvider theme={theme}>{children}</ThemeProvider>
  ),
  FormContent: ({
    children,
    onSubmit,
  }: {
    children: ReactNode;
    onSubmit?: FormEventHandler<HTMLFormElement>;
  }) => <form onSubmit={onSubmit}>{children}</form>,
}));
vi.mock('@/components/common/Toast', () => ({
  useToast: () => ({ success: mocks.success, error: mocks.error }),
}));
// 지원서 초안은 sessionStorage 초안(form-draft)에 챌린지별 키로 저장된다.
vi.mock('@/lib/form-draft', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/form-draft')>()),
  readFormDraft: (key: string) =>
    mocks.draft && key === `application-new:${mocks.draft.challengeId}`
      ? (mocks.draft.answers ?? null)
      : null,
  writeFormDraft: (key: string, value: unknown, options?: unknown) =>
    mocks.save(key, value, options),
  clearFormDraft: (key: string, options?: unknown) => mocks.clear(key, options),
}));
vi.mock('@/lib/payments', () => ({ requestTossPayment: mocks.pay }));
vi.mock('@semochal/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@semochal/api-client')>()),
  generated: {
    useGetChallenge: () => ({
      data: mocks.failed
        ? undefined
        : {
            status: 200,
            data: { title: '공고', roles: ['개발'], applicationForm: mocks.questions },
          },
      isError: mocks.failed,
    }),
    applyChallenge: mocks.apply,
    cancelOrder: vi.fn(() => Promise.resolve()),
    useRequestPresignedUpload: () => ({
      mutateAsync: ({ data }: { data: unknown }) => mocks.presign(data),
    }),
    useFinalizeUpload: () => ({ mutateAsync: ({ id }: { id: string }) => mocks.finalize(id) }),
  },
}));

const fileId = '11111111-1111-4111-8111-111111111111';
const DRAFT_KEY = 'application-new:challenge-1';
const SESSION_DRAFT = { storage: 'session' };
const questions: Question[] = (
  ['short', 'long', 'dropdown', 'radio', 'checkbox', 'file'] as const
).map((type) => ({ id: type, title: type, type, required: true, options: ['A', 'B'] }));

describe('saved application questionnaires', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.questions = [];
    mocks.failed = false;
    mocks.draft = null;
    mocks.apply.mockResolvedValue({ status: 201, data: { id: 'app-1', order: null } });
    mocks.presign.mockResolvedValue({
      status: 201,
      data: { fileId, uploadUrl: 'https://example.com/upload' },
    });
    mocks.finalize.mockResolvedValue({ status: 201, data: { id: fileId } });
    mocks.upload.mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', mocks.upload);
  });

  it('renders all six question types in order and submits selected answers and a finalized private attachment', async () => {
    mocks.questions = questions;
    const user = userEvent.setup();
    const { container } = render(<ApplicationPage />);
    expect(
      Array.from(container.querySelectorAll('legend')).map((node) => node.textContent),
    ).toEqual(questions.map((q) => `${q.title} (필수)`));
    await user.type(screen.getByLabelText('short'), '짧은 답변');
    await user.type(screen.getByLabelText('long'), '긴 답변');
    await user.click(screen.getByRole('combobox', { name: 'dropdown' }));
    await user.click(screen.getByRole('option', { name: 'A' }));
    await user.click(
      within(screen.getByRole('group', { name: 'radio (필수)' })).getByLabelText('B'),
    );
    await user.click(
      within(screen.getByRole('group', { name: 'checkbox (필수)' })).getByLabelText('A'),
    );
    await user.upload(
      screen.getByLabelText('file'),
      new File(['%PDF'], 'answer.pdf', { type: 'application/pdf' }),
    );
    await waitFor(() => expect(screen.getByText('첨부 완료')).toBeTruthy());
    await user.click(screen.getByRole('button', { name: '제출' }));
    await waitFor(() =>
      expect(mocks.apply).toHaveBeenCalledWith(
        expect.objectContaining({
          formAnswers: [
            { questionId: 'short', value: '짧은 답변' },
            { questionId: 'long', value: '긴 답변' },
            { questionId: 'dropdown', value: 'A' },
            { questionId: 'radio', value: 'B' },
            { questionId: 'checkbox', value: ['A'] },
            { questionId: 'file', value: [fileId] },
          ],
        }),
      ),
    );
    expect(mocks.presign).toHaveBeenCalledWith(
      expect.objectContaining({ bucket: 'private', contentType: 'application/pdf' }),
    );
    expect(mocks.finalize).toHaveBeenCalledWith(fileId);
    expect(mocks.push).toHaveBeenCalledWith('/my/applications');
  });

  it('rejects missing required checkbox answers before creating an application or starting payment', () => {
    mocks.questions = [questions[4]!];
    const { container } = render(<ApplicationPage />);
    fireEvent.submit(container.querySelector('form')!);
    expect(mocks.error).toHaveBeenCalledWith('“checkbox” 답변을 확인해 주세요.');
    expect(mocks.apply).not.toHaveBeenCalled();
    expect(mocks.pay).not.toHaveBeenCalled();
  });

  it('keeps the existing no-question flow and allows empty optional answers', async () => {
    mocks.questions = [{ ...questions[0]!, required: false }];
    const user = userEvent.setup();
    const rendered = render(<ApplicationPage />);
    await user.click(screen.getByRole('button', { name: '제출' }));
    await waitFor(() =>
      expect(mocks.apply).toHaveBeenCalledWith(expect.objectContaining({ formAnswers: [] })),
    );
    rendered.unmount();
    mocks.questions = [];
    render(<ApplicationPage />);
    expect(screen.queryAllByRole('group')).toHaveLength(0);
  });

  it('does not accept an attachment when upload verification fails', async () => {
    mocks.questions = [questions[5]!];
    mocks.finalize.mockRejectedValueOnce(new Error('invalid file'));
    const user = userEvent.setup();
    const { container } = render(<ApplicationPage />);
    await user.upload(
      screen.getByLabelText('file'),
      new File(['bad'], 'answer.pdf', { type: 'application/pdf' }),
    );
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('업로드하지 못했습니다'),
    );
    expect(screen.queryByText('첨부 완료')).toBeNull();
    fireEvent.submit(container.querySelector('form')!);
    expect(mocks.apply).not.toHaveBeenCalled();
  });

  it('shows an inline spinner on the submit button while the application is being created', async () => {
    mocks.questions = [{ ...questions[0]!, required: false }];
    let resolveApply: ((value: unknown) => void) | undefined;
    mocks.apply.mockReturnValue(
      new Promise((resolve) => {
        resolveApply = resolve;
      }),
    );
    const user = userEvent.setup();
    const { container } = render(<ApplicationPage />);
    await user.click(screen.getByRole('button', { name: '제출' }));

    // 제출 중에는 문구가 바뀌고 인라인 스피너가 붙는다.
    expect(screen.getByRole('button', { name: '처리 중…' })).toBeTruthy();
    expect(container.querySelector('[data-component="submit-spinner"]')).toBeTruthy();

    resolveApply?.({ status: 201, data: { id: 'app-1', order: null } });
    await waitFor(() =>
      expect(container.querySelector('[data-component="submit-spinner"]')).toBeNull(),
    );
  });

  it('drops the attachments the server reports as invalid', async () => {
    mocks.questions = [{ ...questions[5]!, id: 'file' }];
    mocks.apply.mockRejectedValueOnce(
      new ApiError(400, {
        message: '유효하지 않은 첨부파일이 있습니다.',
        invalidFileIds: [fileId],
      }),
    );
    const user = userEvent.setup();
    render(<ApplicationPage />);
    await user.upload(
      screen.getByLabelText('file'),
      new File(['a'], 'a.pdf', { type: 'application/pdf' }),
    );
    await screen.findByText(/첨부 완료/);
    await user.click(screen.getByRole('button', { name: '제출' }));
    await waitFor(() => expect(mocks.apply).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(mocks.error).toHaveBeenCalledWith(
        '첨부파일을 다시 올려주세요',
        '유효하지 않은 첨부파일이 있습니다.',
      ),
    );
    await waitFor(() => expect(screen.queryByText(/첨부 완료/)).toBeNull());
  });

  it('does not submit an unloaded challenge and preserves inputs after API failure', async () => {
    mocks.failed = true;
    const { container, unmount } = render(<ApplicationPage />);
    fireEvent.submit(container.querySelector('form')!);
    expect(mocks.apply).not.toHaveBeenCalled();
    unmount();
    mocks.failed = false;
    mocks.questions = [questions[0]!];
    mocks.apply.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const user = userEvent.setup();
    render(<ApplicationPage />);
    await user.type(screen.getByLabelText('short'), '내 답변');
    await user.click(screen.getByRole('button', { name: '제출' }));
    await waitFor(() =>
      expect(mocks.error).toHaveBeenCalledWith('신청에 실패했어요', NETWORK_ERROR_MESSAGE),
    );
    expect((screen.getByLabelText('short') as HTMLInputElement).value).toBe('내 답변');
  });

  it('restores the saved draft when it belongs to the current challenge', () => {
    mocks.questions = [{ ...questions[0]!, required: false }];
    mocks.draft = { challengeId: 'challenge-1', answers: { short: '저장된 답변' } };
    render(<ApplicationPage />);
    expect((screen.getByLabelText('short') as HTMLInputElement).value).toBe('저장된 답변');
  });

  it('ignores a draft saved for a different challenge', () => {
    mocks.questions = [{ ...questions[0]!, required: false }];
    mocks.draft = { challengeId: 'challenge-2', answers: { short: '다른 챌린지 답변' } };
    render(<ApplicationPage />);
    expect((screen.getByLabelText('short') as HTMLInputElement).value).toBe('');
  });

  it('saves the draft manually with the 임시저장 button', async () => {
    mocks.questions = [{ ...questions[0]!, required: false }];
    const user = userEvent.setup();
    render(<ApplicationPage />);
    await user.type(screen.getByLabelText('short'), '수동 저장 답변');
    await user.click(screen.getByRole('button', { name: '임시저장' }));
    expect(mocks.save).toHaveBeenCalledWith(DRAFT_KEY, { short: '수동 저장 답변' }, SESSION_DRAFT);
    expect(mocks.success).toHaveBeenCalledWith('임시저장했어요');
  });

  it('auto-saves edited answers to the session draft after the debounce', async () => {
    mocks.questions = [{ ...questions[0]!, required: false }];
    const user = userEvent.setup();
    render(<ApplicationPage />);
    await user.type(screen.getByLabelText('short'), '자동 저장할 답변');
    // 디바운스(500ms)가 지나기 전에는 저장하지 않는다.
    expect(mocks.save).not.toHaveBeenCalled();
    await waitFor(
      () =>
        expect(mocks.save).toHaveBeenCalledWith(
          DRAFT_KEY,
          { short: '자동 저장할 답변' },
          SESSION_DRAFT,
        ),
      { timeout: 2000 },
    );
  });

  it('does not auto-save the untouched form on mount', async () => {
    mocks.questions = [{ ...questions[0]!, required: false }];
    render(<ApplicationPage />);
    // 사용자가 고치기 전에는 디바운스가 지나도 초안을 저장하지 않는다(다른 챌린지 초안 보호).
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it('clears the draft when a free application succeeds', async () => {
    mocks.questions = [{ ...questions[0]!, required: false }];
    const user = userEvent.setup();
    render(<ApplicationPage />);
    await user.type(screen.getByLabelText('short'), '답변');
    await user.click(screen.getByRole('button', { name: '제출' }));
    await waitFor(() => expect(mocks.clear).toHaveBeenCalled());
    expect(mocks.push).toHaveBeenCalledWith('/my/applications');
    // 초안이 지워진 뒤 남은 자동 저장 디바운스 타이머가 다시 저장하지 않는다.
    const saveCallsAfterClear = mocks.save.mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(mocks.save.mock.calls.length).toBe(saveCallsAfterClear);
  });

  it('clears the draft once a paid application is created, before the payment window', async () => {
    mocks.questions = [{ ...questions[0]!, required: false }];
    mocks.apply.mockResolvedValue({
      status: 201,
      data: { id: 'app-1', order: { id: 'order-1', amount: 1000, name: '공고' } },
    });
    mocks.pay.mockResolvedValue(true);
    const user = userEvent.setup();
    render(<ApplicationPage />);
    await user.type(screen.getByLabelText('short'), '유료 답변');
    await user.click(screen.getByRole('button', { name: '제출' }));
    await waitFor(() => expect(mocks.clear).toHaveBeenCalled());
    expect(mocks.pay).toHaveBeenCalled();
    // 초안이 지워진 뒤 남은 자동 저장 디바운스 타이머가 다시 저장하지 않는다.
    const saveCallsAfterClear = mocks.save.mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(mocks.save.mock.calls.length).toBe(saveCallsAfterClear);
  });

  it('keeps the draft when the application fails', async () => {
    mocks.questions = [{ ...questions[0]!, required: false }];
    mocks.apply.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const user = userEvent.setup();
    render(<ApplicationPage />);
    await user.click(screen.getByRole('button', { name: '제출' }));
    await waitFor(() =>
      expect(mocks.error).toHaveBeenCalledWith('신청에 실패했어요', NETWORK_ERROR_MESSAGE),
    );
    expect(mocks.clear).not.toHaveBeenCalled();
  });
});
