import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { generated } from '@semochal/api-client';
import { useUserStore } from '@/stores/useUserStore';
import { RecruitmentPage } from './RecruitmentPage';

const h = vi.hoisted(() => ({
  search: '',
  push: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  mutate: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: h.push }),
  useSearchParams: () => new URLSearchParams(h.search),
}));

vi.mock('@semochal/api-client', () => ({
  generated: {
    useCreateTeam: vi.fn(),
  },
}));

vi.mock('@/components/common/UserShell', () => ({
  UserShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/common/Toast', () => ({
  useToast: () => ({ success: h.toastSuccess, error: h.toastError }),
}));

vi.mock('@/components/common/Primitives', () => {
  const Passthrough = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  return {
    Button: ({
      children,
      type,
      disabled,
    }: {
      children: ReactNode;
      type?: 'button' | 'submit';
      disabled?: boolean;
    }) => (
      <button type={type} disabled={disabled}>
        {children}
      </button>
    ),
    Input: (props: Record<string, unknown>) => <input {...props} />,
    Stack: Passthrough,
    Row: Passthrough,
    Icon: () => <span />,
    IconButton: ({
      children,
      'aria-label': ariaLabel,
    }: {
      children: ReactNode;
      'aria-label': string;
    }) => (
      <button type="button" aria-label={ariaLabel}>
        {children}
      </button>
    ),
    DesktopOnly: Passthrough,
    Title: ({ children }: { children: ReactNode }) => <h1>{children}</h1>,
  };
});

vi.mock('@/components/ui/Dropdown', () => ({
  Dropdown: ({ 'aria-label': ariaLabel }: { 'aria-label': string }) => (
    <select aria-label={ariaLabel} />
  ),
}));

// ChallengeSearch 자체는 단위 테스트로 커버하고, 이 페이지 테스트에서는 전달 계약(value/id, 옵션)만 본다.
vi.mock('@/components/contests/ChallengeSearch', () => ({
  ChallengeSearch: (props: { value: string; includeClosed?: boolean; placeholder?: string }) => (
    <div
      data-testid="challenge-search"
      data-value={props.value}
      data-include-closed={String(props.includeClosed)}
      data-placeholder={props.placeholder}
    />
  ),
}));

const initialRecruitment = {
  challenge: '',
  introduction: '',
  role: '프론트엔드',
  preferred: '',
  etc: '',
  slots: [] as { id: number; role: string; count: number }[],
};

describe('RecruitmentPage', () => {
  beforeEach(() => {
    h.search = '';
    h.push.mockClear();
    h.toastSuccess.mockClear();
    h.toastError.mockClear();
    h.mutate.mockClear();
    vi.mocked(generated.useCreateTeam).mockReturnValue({
      mutate: h.mutate,
      isPending: false,
    } as never);
    useUserStore.setState({ recruitment: { ...initialRecruitment } });
  });

  afterEach(cleanup);

  it('?challengeId= 진입 시 초안에 반영해 챌린지 검색에 id를 전달한다', async () => {
    h.search = 'challengeId=challenge-9';
    render(<RecruitmentPage />);
    await waitFor(() =>
      expect(screen.getByTestId('challenge-search').getAttribute('data-value')).toBe('challenge-9'),
    );
  });

  it('챌린지 검색에는 종료 챌린지를 제외하는 옵션을 전달한다', () => {
    render(<RecruitmentPage />);
    const search = screen.getByTestId('challenge-search');
    expect(search.getAttribute('data-include-closed')).toBe('false');
    expect(search.getAttribute('data-placeholder')).toBe('챌린지를 검색하세요');
  });

  it('게시하면 선택한 챌린지 id로 팀 생성을 요청한다', () => {
    useUserStore.setState({
      recruitment: {
        ...initialRecruitment,
        challenge: 'challenge-1',
        introduction: '팀 소개',
        slots: [{ id: 1, role: '백엔드', count: 2 }],
      },
    });
    render(<RecruitmentPage />);
    const form = screen.getByText('게시하기').closest('form');
    expect(form).not.toBeNull();
    fireEvent.submit(form as HTMLFormElement);
    expect(h.mutate).toHaveBeenCalledWith({
      data: {
        challengeId: 'challenge-1',
        introduction: '팀 소개',
        openRoles: [{ role: '백엔드', count: 2 }],
        myRole: '프론트엔드',
        preferred: undefined,
        etc: undefined,
      },
    });
  });

  it('챌린지를 고르지 않으면 게시하지 않고 에러를 보여준다', () => {
    useUserStore.setState({
      recruitment: {
        ...initialRecruitment,
        introduction: '팀 소개',
        slots: [{ id: 1, role: '백엔드', count: 1 }],
      },
    });
    render(<RecruitmentPage />);
    fireEvent.submit(screen.getByText('게시하기').closest('form') as HTMLFormElement);
    expect(h.mutate).not.toHaveBeenCalled();
    expect(h.toastError).toHaveBeenCalledWith(
      '챌린지를 선택해주세요',
      '검색에서 챌린지를 골라주세요',
    );
  });
});
