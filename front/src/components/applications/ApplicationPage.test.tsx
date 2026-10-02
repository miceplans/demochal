import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { ApplicationPage } from './ApplicationPage';
import { ThemeProvider } from '@emotion/react';
import { theme } from '@/styles/theme';
import type { Question } from './ApplicationQuestions';

const mocks = vi.hoisted(() => ({
  apply: vi.fn(),
  presign: vi.fn(),
  finalize: vi.fn(),
  upload: vi.fn(),
  push: vi.fn(),
  save: vi.fn(),
  error: vi.fn(),
  success: vi.fn(),
  pay: vi.fn(),
  questions: [] as Question[],
  failed: false,
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push }),
  useSearchParams: () => new URLSearchParams('challenge=challenge-1'),
}));
vi.mock('@/components/common/UserShell', () => ({
  UserShell: ({ children }: { children: ReactNode }) => (
    <ThemeProvider theme={theme}>{children}</ThemeProvider>
  ),
}));
vi.mock('@/components/common/Toast', () => ({
  useToast: () => ({ success: mocks.success, error: mocks.error }),
}));
vi.mock('@/stores/useUserStore', () => ({
  useUserStore: (selector: (s: unknown) => unknown) =>
    selector({ applicationDraft: null, saveApplication: mocks.save }),
}));
vi.mock('@/lib/ad-api', () => ({ adApi: { orders: { cancel: vi.fn() } } }));
vi.mock('@/lib/payments', () => ({ requestTossPayment: mocks.pay }));
vi.mock('@semochal/api-client', () => ({
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
    requestPresignedUpload: mocks.presign,
    finalizeUpload: mocks.finalize,
  },
}));

const fileId = '11111111-1111-4111-8111-111111111111';
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
    await user.type(screen.getByLabelText('팀원 1 이름'), '참가자');
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
            { questionId: 'file', value: fileId },
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
    await user.type(screen.getByLabelText('팀원 1 이름'), '참가자');
    await user.click(screen.getByRole('button', { name: '제출' }));
    await waitFor(() =>
      expect(mocks.apply).toHaveBeenCalledWith(expect.objectContaining({ formAnswers: [] })),
    );
    rendered.unmount();
    mocks.questions = [];
    render(<ApplicationPage />);
    expect(screen.queryAllByRole('group')).toHaveLength(0);
    expect(screen.getByLabelText('팀원 1 이름')).toBeTruthy();
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

  it('does not submit an unloaded challenge and preserves inputs after API failure', async () => {
    mocks.failed = true;
    const { container, unmount } = render(<ApplicationPage />);
    fireEvent.submit(container.querySelector('form')!);
    expect(mocks.apply).not.toHaveBeenCalled();
    unmount();
    mocks.failed = false;
    mocks.questions = [questions[0]!];
    mocks.apply.mockRejectedValueOnce(new Error('rejected'));
    const user = userEvent.setup();
    render(<ApplicationPage />);
    await user.type(screen.getByLabelText('팀원 1 이름'), '참가자');
    await user.type(screen.getByLabelText('short'), '내 답변');
    await user.click(screen.getByRole('button', { name: '제출' }));
    await waitFor(() =>
      expect(mocks.error).toHaveBeenCalledWith('신청에 실패했어요', '잠시 후 다시 시도해주세요'),
    );
    expect((screen.getByLabelText('short') as HTMLInputElement).value).toBe('내 답변');
  });
});
