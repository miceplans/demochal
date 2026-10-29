import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BizNavProvider, BizSidebar, isMenuActive } from './BizShell';

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  logoutMutate: vi.fn(),
  auth: undefined as
    { status: number; data: { name: string; profileImageUrl?: string | null } } | undefined,
  business: undefined as
    | {
        status: number;
        data: { name: string; logoImageFileId?: string; verificationStatus?: string };
      }
    | undefined,
  logoFile: undefined as { status: number; data: { url?: string | null } } | undefined,
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/biz/dashboard',
  useRouter: () => ({ push: mocks.push }),
}));
vi.mock('@semochal/api-client', () => ({
  generated: {
    useGetMyAuthInfo: () => ({ data: mocks.auth }),
    useFindMyBusiness: () => ({ data: mocks.business }),
    useGetFile: (id: string) => ({ data: id ? mocks.logoFile : undefined }),
    useLogout: () => ({ mutate: mocks.logoutMutate }),
  },
}));

function renderSidebar() {
  return render(
    <BizNavProvider base="/biz">
      <BizSidebar />
    </BizNavProvider>,
  );
}

const profileAvatar = (container: HTMLElement) =>
  container.querySelector('a[aria-label="내 프로필"] img');

describe('BizSidebar 프로필 아바타', () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth = { status: 200, data: { name: '기업 담당자', profileImageUrl: null } };
    mocks.business = { status: 200, data: { name: '예시 기업' } };
    mocks.logoFile = undefined;
  });

  it('기업 로고가 있으면 로고 이미지를 표시한다', () => {
    mocks.business = {
      status: 200,
      data: { name: '예시 기업', logoImageFileId: 'logo-file' },
    };
    mocks.logoFile = { status: 200, data: { url: 'https://cdn.test/logo.png' } };

    const { container } = renderSidebar();
    const avatar = profileAvatar(container);

    expect(avatar).not.toBeNull();
    expect(avatar?.getAttribute('src')).toBe('https://cdn.test/logo.png');
    expect(screen.queryByText('기')).toBeNull();
  });

  it('로고가 없으면 내 프로필 이미지를 표시한다', () => {
    mocks.auth = {
      status: 200,
      data: { name: '기업 담당자', profileImageUrl: 'https://cdn.test/me.png' },
    };

    const { container } = renderSidebar();
    const avatar = profileAvatar(container);

    expect(avatar?.getAttribute('src')).toBe('https://cdn.test/me.png');
  });

  it('로고 파일을 아직 못 불러왔으면 프로필 이미지로 폰백한다', () => {
    mocks.business = {
      status: 200,
      data: { name: '예시 기업', logoImageFileId: 'logo-file' },
    };
    mocks.auth = {
      status: 200,
      data: { name: '기업 담당자', profileImageUrl: 'https://cdn.test/me.png' },
    };

    const { container } = renderSidebar();

    expect(profileAvatar(container)?.getAttribute('src')).toBe('https://cdn.test/me.png');
  });

  it('로고와 프로필 이미지가 모두 없으면 이름 첫 글자를 표시한다', () => {
    const { container } = renderSidebar();

    expect(profileAvatar(container)).toBeNull();
    expect(screen.getByText('기')).not.toBeNull();
  });

  it('기존 사이드바 동작에 회귀가 없다', async () => {
    const user = userEvent.setup();
    renderSidebar();

    // 현재 경로(/biz/dashboard) 메뉴가 활성 상태다.
    expect(screen.getByRole('link', { name: '대시보드' }).getAttribute('aria-current')).toBe(
      'page',
    );
    // 로그아웃 버튼이 동작한다.
    await user.click(screen.getByRole('button', { name: '로그아웃' }));
    expect(mocks.logoutMutate).toHaveBeenCalled();
  });
});

describe('isMenuActive 메뉴 별칭', () => {
  it('지원서 관리(/applications) 화면에서는 공고 관리 메뉴가 활성 상태다', () => {
    expect(isMenuActive('/applications', '/postings')).toBe(true);
  });

  it('공고 등록·상세 화면에서도 공고 관리 메뉴가 활성 상태다', () => {
    expect(isMenuActive('/postings/new', '/postings')).toBe(true);
    expect(isMenuActive('/postings/ch-1', '/postings')).toBe(true);
  });

  it('별칭이 없는 다른 화면에서는 공고 관리 메뉴가 활성 상태가 아니다', () => {
    expect(isMenuActive('/billing', '/postings')).toBe(false);
  });
});
