import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { generated } from '@semochal/api-client';
import { ProfilePage } from './ProfilePage';

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('id=u1'),
}));

vi.mock('@semochal/api-client', () => ({
  generated: {
    useGetMyAuthInfo: vi.fn(),
    useGetUser: vi.fn(),
    useListManagedTeams: vi.fn(),
  },
}));

vi.mock('@/components/common/UserShell', () => ({
  UserShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Content: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/people/ScoutModal', () => ({ ScoutModal: () => null }));

function mockUser(profileImageUrl: string | null) {
  vi.mocked(generated.useGetUser).mockReturnValue({
    isPending: false,
    data: { status: 200, data: { id: 'u1', name: '홍길동', stacks: ['React'], profileImageUrl } },
  } as never);
}

describe('ProfilePage 아바타', () => {
  beforeEach(() => {
    vi.mocked(generated.useGetMyAuthInfo).mockReturnValue({ isPending: false } as never);
    vi.mocked(generated.useListManagedTeams).mockReturnValue({} as never);
  });
  afterEach(cleanup);

  it('profileImageUrl이 있으면 해당 이미지를 표시한다', () => {
    mockUser('https://cdn.example.com/a.png');
    const { container } = render(<ProfilePage />);
    expect(container.querySelector('img')?.getAttribute('src')).toBe(
      'https://cdn.example.com/a.png',
    );
    expect(screen.getByText('React')).toBeTruthy();
  });

  it('profileImageUrl이 없으면 기본 이미지를 표시한다', () => {
    mockUser(null);
    const { container } = render(<ProfilePage />);
    expect(container.querySelector('img')?.getAttribute('src')).toBe('/assets/default-profile.png');
  });
});
