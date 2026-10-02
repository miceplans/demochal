import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ButtonHTMLAttributes, InputHTMLAttributes } from 'react';
import { BizApplicationFormPage } from './BizApplicationFormPage';

type FixtureQuestion = {
  id: string;
  title: string;
  type: 'dropdown' | 'checkbox' | 'radio' | 'file' | 'short' | 'long';
  options: string[];
  required: boolean;
};
type FixtureChallenge = {
  title: string;
  startDate: string;
  endDate: string;
  applicationForm: FixtureQuestion[];
};

const mocks = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  push: vi.fn(),
  invalidateQueries: vi.fn(),
  challenge: undefined as unknown as FixtureChallenge,
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'challenge-1' }),
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
}));

vi.mock('@semochal/api-client', () => ({
  generated: {
    useGetMyChallenge: () => ({
      data: { status: 200, data: mocks.challenge },
      isPending: false,
      refetch: vi.fn(),
    }),
    useUpdateChallenge: () => ({ mutateAsync: mocks.mutateAsync, isPending: false }),
    getGetMyChallengeQueryKey: (id: string) => ['my-challenge', id],
  },
}));

vi.mock('@/components/biz/BizShell', () => ({
  PrimaryButton: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
  FieldInput: (props: InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
  useBizHref: () => (path: string) => path,
}));

vi.mock('@/components/common/Toast', () => ({
  useToast: () => ({ success: mocks.success, error: mocks.error }),
}));

vi.mock('@/components/ui/Dropdown', () => ({
  Dropdown: ({ 'aria-label': label }: { 'aria-label'?: string }) => <div aria-label={label} />,
}));

const GRIP_TITLE = '드래그해 옵션 순서를 바꾸세요';

function optionRow(label: string): HTMLElement {
  const input = screen.getByLabelText(label);
  const row = input.closest('div');
  if (!row) throw new Error(`option row not found for ${label}`);
  return row;
}

function optionValues(questionIndex: number, count: number): string[] {
  return Array.from(
    { length: count },
    (_, i) => screen.getByLabelText(`질문 ${questionIndex} 옵션 ${i + 1}`) as HTMLInputElement,
  ).map((el) => el.value);
}

// jsdom에는 DataTransfer 구현이 없어 이벤트에 붙일 스텁을 직접 만든다.
function dragOptionTo(fromLabel: string, toLabel: string) {
  const dataTransfer = { setData: vi.fn(), effectAllowed: '', dropEffect: '' };
  fireEvent.dragStart(within(optionRow(fromLabel)).getByTitle(GRIP_TITLE), { dataTransfer });
  fireEvent.dragOver(optionRow(toLabel), { dataTransfer });
  fireEvent.drop(optionRow(toLabel), { dataTransfer });
}

function publishedForm(): unknown {
  return mocks.mutateAsync.mock.calls[0]?.[0];
}

describe('BizApplicationFormPage option reorder', () => {
  afterEach(cleanup);
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.challenge = {
      title: '데모 챌린지',
      startDate: '2026-10-01',
      endDate: '2026-10-31',
      applicationForm: [
        {
          id: 'q-1',
          title: '지원 포지션',
          type: 'radio',
          options: ['옵션 1', '옵션 2', '옵션 3'],
          required: true,
        },
      ],
    };
  });

  it('reorders options when option 1 is dropped on option 3’s row and publishes the new order', async () => {
    const user = userEvent.setup();
    render(<BizApplicationFormPage />);
    expect(optionValues(1, 3)).toEqual(['옵션 1', '옵션 2', '옵션 3']);

    dragOptionTo('질문 1 옵션 1', '질문 1 옵션 3');
    expect(optionValues(1, 3)).toEqual(['옵션 2', '옵션 3', '옵션 1']);

    await user.click(screen.getByRole('button', { name: '신청서 게시' }));
    await waitFor(() =>
      expect(publishedForm()).toEqual({
        id: 'challenge-1',
        data: {
          applicationForm: [
            {
              id: 'q-1',
              title: '지원 포지션',
              type: 'radio',
              options: ['옵션 2', '옵션 3', '옵션 1'],
              required: true,
            },
          ],
        },
      }),
    );
    expect(mocks.success).toHaveBeenCalledWith('신청서가 게시되었습니다');
    expect(mocks.push).toHaveBeenCalledWith('/postings/challenge-1');
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['my-challenge', 'challenge-1'],
    });
  });

  it('keeps the original order when an option is dropped on its own row', async () => {
    const user = userEvent.setup();
    render(<BizApplicationFormPage />);

    dragOptionTo('질문 1 옵션 2', '질문 1 옵션 2');
    expect(optionValues(1, 3)).toEqual(['옵션 1', '옵션 2', '옵션 3']);

    await user.click(screen.getByRole('button', { name: '신청서 게시' }));
    await waitFor(() =>
      expect(publishedForm()).toEqual({
        id: 'challenge-1',
        data: {
          applicationForm: [
            {
              id: 'q-1',
              title: '지원 포지션',
              type: 'radio',
              options: ['옵션 1', '옵션 2', '옵션 3'],
              required: true,
            },
          ],
        },
      }),
    );
  });

  it('ignores a drop on another question’s option row', async () => {
    mocks.challenge = {
      ...mocks.challenge,
      applicationForm: [
        {
          id: 'q-1',
          title: '지원 포지션',
          type: 'radio',
          options: ['옵션 A', '옵션 B'],
          required: false,
        },
        {
          id: 'q-2',
          title: '희망 직무',
          type: 'checkbox',
          options: ['옵션 C', '옵션 D'],
          required: false,
        },
      ],
    };
    const user = userEvent.setup();
    render(<BizApplicationFormPage />);

    dragOptionTo('질문 1 옵션 1', '질문 2 옵션 1');
    expect(optionValues(1, 2)).toEqual(['옵션 A', '옵션 B']);
    expect(optionValues(2, 2)).toEqual(['옵션 C', '옵션 D']);

    await user.click(screen.getByRole('button', { name: '신청서 게시' }));
    await waitFor(() =>
      expect(publishedForm()).toEqual({
        id: 'challenge-1',
        data: {
          applicationForm: [
            {
              id: 'q-1',
              title: '지원 포지션',
              type: 'radio',
              options: ['옵션 A', '옵션 B'],
              required: false,
            },
            {
              id: 'q-2',
              title: '희망 직무',
              type: 'checkbox',
              options: ['옵션 C', '옵션 D'],
              required: false,
            },
          ],
        },
      }),
    );
  });

  it('disables the option delete button when the question has a single option', () => {
    mocks.challenge = {
      ...mocks.challenge,
      applicationForm: [
        { id: 'q-1', title: '단일 옵션 질문', type: 'radio', options: ['옵션 1'], required: false },
        {
          id: 'q-2',
          title: '다중 옵션 질문',
          type: 'radio',
          options: ['옵션 A', '옵션 B'],
          required: false,
        },
      ],
    };
    render(<BizApplicationFormPage />);

    // 옵션 삭제 버튼 aria-label은 질문을 구분하지 않아(옵션 N 삭제) DOM 순서로 매칭한다.
    const firstOptionDeleteButtons = screen.getAllByRole('button', { name: '옵션 1 삭제' });
    expect(firstOptionDeleteButtons[0]).toHaveProperty('disabled', true);
    expect(firstOptionDeleteButtons[1]).toHaveProperty('disabled', false);
  });
});
