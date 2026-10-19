import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { generated } from '@semochal/api-client';
import { ReportFormPage } from './ReportFormPage';

const h = vi.hoisted(() => ({ search: '' }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ back: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(h.search),
}));

vi.mock('@semochal/api-client', () => ({
  generated: {
    useGetChallenge: vi.fn(),
    useGetTeam: vi.fn(),
    useGetUser: vi.fn(),
    useCreateReport: vi.fn(),
  },
}));

vi.mock('@/components/common/UserShell', () => ({
  UserShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Content: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/common/Toast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

vi.mock('@/components/common/Primitives', () => {
  const Passthrough = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return { Button: Passthrough, Muted: Passthrough, Title: Passthrough };
});

vi.mock('@/components/ui/Dropdown', () => ({
  Dropdown: ({ 'aria-label': ariaLabel }: { 'aria-label': string }) => (
    <select aria-label={ariaLabel} />
  ),
}));

const CHALLENGE_ID = '9238bb49-8673-4fb0-9a96-5d5225dba986';
const TEAM_ID = '0b7a1c2d-3e4f-4a5b-8c9d-0e1f2a3b4c5d';
const USER_ID = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5e';

const CHALLENGE = {
  id: CHALLENGE_ID,
  title: '테스트 챌린지',
  organizer: '주최 기관',
  startDate: '2026-10-27T15:00:00.000Z',
  endDate: '2026-10-31T14:59:00.000Z',
};

function setNoTarget() {
  vi.mocked(generated.useGetChallenge).mockReturnValue({ isPending: false } as never);
  vi.mocked(generated.useGetTeam).mockReturnValue({ isPending: false } as never);
  vi.mocked(generated.useGetUser).mockReturnValue({ isPending: false } as never);
}

describe('ReportFormPage 신고 대상 미리보기 이미지', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.search = '';
    vi.mocked(generated.useCreateReport).mockReturnValue({ mutate: vi.fn() } as never);
  });

  afterEach(() => cleanup());

  it('challenge 대상의 posterUrl을 이미지로 표시한다', () => {
    h.search = `targetType=challenge&targetId=${CHALLENGE_ID}`;
    setNoTarget();
    vi.mocked(generated.useGetChallenge).mockReturnValue({
      isPending: false,
      data: { status: 200, data: { ...CHALLENGE, posterUrl: '/poster.png' } },
    } as never);

    const { container } = render(<ReportFormPage />);

    expect(container.querySelector('img')?.getAttribute('src')).toBe('/poster.png');
  });

  it('posterUrl이 없으면 이미지 대신 placeholder를 표시한다', () => {
    h.search = `targetType=challenge&targetId=${CHALLENGE_ID}`;
    setNoTarget();
    vi.mocked(generated.useGetChallenge).mockReturnValue({
      isPending: false,
      data: { status: 200, data: { ...CHALLENGE, posterUrl: null } },
    } as never);

    const { container } = render(<ReportFormPage />);

    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('테스트 챌린지');
  });

  it('team 대상의 challengePosterUrl을 이미지로 표시한다', () => {
    h.search = `targetType=team&targetId=${TEAM_ID}`;
    setNoTarget();
    vi.mocked(generated.useGetTeam).mockReturnValue({
      isPending: false,
      data: {
        status: 200,
        data: { title: '팀 모집글', challengePosterUrl: '/team-poster.png' },
      },
    } as never);

    const { container } = render(<ReportFormPage />);

    expect(container.querySelector('img')?.getAttribute('src')).toBe('/team-poster.png');
  });

  it('user 대상의 profileImageUrl을 이미지로 표시한다', () => {
    h.search = `targetType=user&targetId=${USER_ID}`;
    setNoTarget();
    vi.mocked(generated.useGetUser).mockReturnValue({
      isPending: false,
      data: {
        status: 200,
        data: { name: '사용자', profileImageUrl: '/profile.png' },
      },
    } as never);

    const { container } = render(<ReportFormPage />);

    expect(container.querySelector('img')?.getAttribute('src')).toBe('/profile.png');
  });

  it('이미지 로드에 실패하면 placeholder로 되돌린다', () => {
    h.search = `targetType=challenge&targetId=${CHALLENGE_ID}`;
    setNoTarget();
    vi.mocked(generated.useGetChallenge).mockReturnValue({
      isPending: false,
      data: { status: 200, data: { ...CHALLENGE, posterUrl: '/broken.png' } },
    } as never);

    const { container } = render(<ReportFormPage />);
    fireEvent.error(container.querySelector('img')!);

    expect(container.querySelector('img')).toBeNull();
  });
});
