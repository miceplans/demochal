import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BizNavProvider } from './BizShell';
import { BizAccessCover } from './BizAccessCover';

const mocks = vi.hoisted(() => ({
  auth: undefined as { status: number; data: { role: string } } | undefined,
  isLoading: false,
}));

vi.mock('@semochal/api-client', () => ({
  generated: {
    useGetMyAuthInfo: () => ({ data: mocks.auth, isLoading: mocks.isLoading }),
  },
}));

function renderCover() {
  return render(
    <BizNavProvider base="/biz">
      <BizAccessCover>
        <div>콘솔 콘텐츠</div>
      </BizAccessCover>
    </BizNavProvider>,
  );
}

describe('BizAccessCover', () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth = undefined;
    mocks.isLoading = false;
  });

  it('shows login and signup links for a non-business session', () => {
    renderCover();

    expect(screen.getByRole('link', { name: '로그인' }).getAttribute('href')).toBe('/biz/login');
    expect(screen.getByRole('link', { name: '회원가입 하기' }).getAttribute('href')).toBe(
      '/biz/signup',
    );
    expect(screen.queryByText('콘솔 콘텐츠')).toBeNull();
  });

  it('renders children for a business session', () => {
    mocks.auth = { status: 200, data: { role: 'business' } };
    renderCover();

    expect(screen.getByText('콘솔 콘텐츠')).not.toBeNull();
    expect(screen.queryByRole('link', { name: '로그인' })).toBeNull();
  });

  it('renders the loading view while auth is being checked', () => {
    mocks.isLoading = true;
    const { container } = renderCover();

    expect(container.querySelector('[aria-busy]')).not.toBeNull();
    expect(screen.queryByText('콘솔 콘텐츠')).toBeNull();
  });
});
