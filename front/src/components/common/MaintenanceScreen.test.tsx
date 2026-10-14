import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { MaintenanceScreen } from './MaintenanceScreen';

vi.mock('next/link', () => ({
  default: ({ children, ...props }: { children: ReactNode } & Record<string, unknown>) => (
    <a {...props}>{children}</a>
  ),
}));

describe('MaintenanceScreen', () => {
  afterEach(cleanup);

  it('Figma 점검 안내 문구와 일러스트를 표시한다', () => {
    render(<MaintenanceScreen />);

    expect(screen.getByRole('heading', { name: '서버 점검 중입니다.' })).toBeTruthy();
    expect(screen.getByText('죄송합니다. 더욱 나은 모습으로 찾아 뵙겠습니다!')).toBeTruthy();
    expect(screen.getByAltText('서버 점검 일러스트').getAttribute('src')).toBe(
      '/assets/maintenance.png',
    );
  });

  it('헤더 네비게이션(공모전 탐색/팀 탐색/팀원 찾기)을 노출한다', () => {
    render(<MaintenanceScreen />);

    expect(screen.getByRole('link', { name: '공모전 탐색' }).getAttribute('href')).toBe('/explore');
    expect(screen.getByRole('link', { name: '팀 탐색' }).getAttribute('href')).toBe('/teams');
    expect(screen.getByRole('link', { name: '팀원 찾기' }).getAttribute('href')).toBe('/people');
    expect(screen.getByRole('link', { name: 'SEMO 홈' }).getAttribute('href')).toBe('/');
  });
});
