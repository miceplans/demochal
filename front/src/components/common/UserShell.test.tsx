import { cleanup, render, screen } from '@testing-library/react';
import { ThemeProvider } from '@emotion/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { theme } from '@/styles/theme';
import { Content, FormContent, MyShell, UserShell } from './UserShell';

const mocks = vi.hoisted(() => ({
  auth: undefined as
    { status: number; data: { name?: string | null; profileImageUrl?: string | null } } | undefined,
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('@semochal/api-client', () => ({
  generated: { useGetMyAuthInfo: () => ({ data: mocks.auth }) },
}));
vi.mock('@/lib/useNotificationStream', () => ({ useNotificationStream: vi.fn() }));

function emotionCss() {
  return Array.from(document.querySelectorAll('style[data-emotion]'))
    .map((node) => node.textContent ?? '')
    .join('\n');
}

describe('Content size variants', () => {
  afterEach(cleanup);

  it('renders the default 1200px container when size is omitted', () => {
    render(<Content>본문</Content>);
    expect(emotionCss()).toContain('min(1200px, calc(100% - 48px))');
  });

  it('renders the medium 720px container for the medium size', () => {
    render(<Content size="medium">본문</Content>);
    expect(emotionCss()).toContain('min(720px, calc(100% - 48px))');
  });

  it('renders the narrow 640px container for the narrow size', () => {
    render(<Content size="narrow">본문</Content>);
    expect(emotionCss()).toContain('min(640px, calc(100% - 48px))');
  });

  it('keeps the shared mobile gutter for every size', () => {
    render(<Content size="narrow">본문</Content>);
    const css = emotionCss();
    expect(css).toContain('@media (max-width: 480px)');
    expect(css).toContain('width:100%');
    expect(css).toContain('padding:24px 16px');
  });
});

describe('FormContent', () => {
  afterEach(cleanup);

  it('renders a form element with the shared container rules', () => {
    const { container } = render(<FormContent size="narrow">폼</FormContent>);
    expect(container.querySelector('form')).toBeTruthy();
    const css = emotionCss();
    expect(css).toContain('min(640px, calc(100% - 48px))');
    expect(css).toContain('padding:24px 16px');
  });
});

describe('로그인 사용자 프로필 아바타', () => {
  beforeEach(() => {
    mocks.auth = { status: 200, data: { name: '홍길동', profileImageUrl: null } };
  });

  afterEach(cleanup);

  it('저장된 사진을 데스크톱 헤더와 MY 사이드바에 표시한다', () => {
    mocks.auth = {
      status: 200,
      data: { name: '홍길동', profileImageUrl: 'https://cdn.test/profile.webp' },
    };
    const { container } = render(
      <ThemeProvider theme={theme}>
        <>
          <UserShell footer={false} navigation={false}>
            <div />
          </UserShell>
          <MyShell title="MY">
            <div />
          </MyShell>
        </>
      </ThemeProvider>,
    );

    const avatars = container.querySelectorAll(
      'a[href="/my"] img[src="https://cdn.test/profile.webp"]',
    );
    expect(avatars).toHaveLength(2);
    expect(screen.getAllByRole('link', { name: '내 프로필' })[0]?.getAttribute('href')).toBe('/my');
  });

  it('사진이 없으면 기존 헤더 아이콘과 MY 플레이스홀더를 유지한다', () => {
    const { container } = render(
      <>
        <UserShell footer={false} navigation={false}>
          <div />
        </UserShell>
        <MyShell title="MY">
          <div />
        </MyShell>
      </>,
    );

    expect(screen.getByAltText('프로필').getAttribute('src')).toBe('/assets/icons/profile.png');
    expect(container.querySelector('aside a[href="/my"] img')).toBeNull();
  });

  it('인증 정보를 아직 받지 못했으면 로그인 진입점과 MY 플레이스홀더를 유지한다', () => {
    mocks.auth = undefined;
    const { container } = render(
      <ThemeProvider theme={theme}>
        <>
          <UserShell footer={false} navigation={false}>
            <div />
          </UserShell>
          <MyShell title="MY">
            <div />
          </MyShell>
        </>
      </ThemeProvider>,
    );

    expect(screen.getByRole('link', { name: '로그인/회원가입' }).getAttribute('href')).toBe(
      '/login',
    );
    expect(container.querySelector('aside a[href="/my"] img')).toBeNull();
  });
});
