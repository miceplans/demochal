import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { LoginPage } from './AuthPages';
import { useUserStore } from '@/stores/useUserStore';

const mocks = vi.hoisted(() => ({ assign: vi.fn() }));

vi.mock('@/components/common/UserShell', () => ({
  UserShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Logo: () => <div />,
}));

vi.mock('@/components/common/Primitives', () => ({
  Button: ({ children }: { children: ReactNode }) => <button>{children}</button>,
  Icon: () => <span />,
  Stack: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Chip: ({ children }: { children: ReactNode }) => <button>{children}</button>,
  Wrap: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/Dropdown', () => ({ Dropdown: () => <select /> }));
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock('@semochal/api-client', () => ({ ApiError: class extends Error {}, generated: {} }));
vi.mock('@/lib/confetti', () => ({ celebrateBadgeAcquisition: vi.fn() }));

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('location', { assign: mocks.assign });
    useUserStore.setState({ hasCompletedOnboarding: false });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('shows only social login options, without email or password inputs', () => {
    render(<LoginPage />);

    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByLabelText('비밀번호')).toBeNull();
    expect(screen.queryByText('또는')).toBeNull();
    expect(screen.getByText('Kakao계정으로 계속하기')).not.toBeNull();
    expect(screen.getByText('Google계정으로 계속하기')).not.toBeNull();
    expect(screen.getByText('Naver계정으로 계속하기')).not.toBeNull();
  });

  it('forwards next to the selected social login route', async () => {
    const user = userEvent.setup();
    render(<LoginPage next="/my/challenges" />);

    await user.click(screen.getByText('Kakao계정으로 계속하기'));

    expect(mocks.assign).toHaveBeenCalledWith('/api/auth/social/kakao?next=%2Fmy%2Fchallenges');
  });
});
