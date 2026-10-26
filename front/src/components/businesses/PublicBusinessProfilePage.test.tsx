import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { ApiError, generated } from '@semochal/api-client';
import { PublicBusinessProfilePage } from './PublicBusinessProfilePage';

// ApiError는 실제 클래스를 써야 컴포넌트의 instanceof 검사가 통한다.
vi.mock('@semochal/api-client', async (importActual) => {
  const actual = await importActual<typeof import('@semochal/api-client')>();
  return {
    ...actual,
    generated: {
      useGetPublicBusiness: vi.fn(),
      useGetPublicBusinessChallenges: vi.fn(),
    },
  };
});

vi.mock('@/components/common/UserShell', () => ({
  UserShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Content: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/common/LoadingState', () => ({
  LoadingState: ({ label }: { label: string }) => <div role="status">{label}</div>,
}));

vi.mock('@/components/common/NotFound', () => ({
  NotFound: ({ homeHref }: { homeHref?: string }) => (
    <div>
      기업을 찾을 수 없어요 <a href={homeHref}>돌아가기</a>
    </div>
  ),
}));

vi.mock('@/components/common/Primitives', () => ({
  Muted: ({ children, ...props }: { children: ReactNode } & Record<string, unknown>) => (
    <p {...props}>{children}</p>
  ),
  Tag: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

vi.mock('@/components/contests/ContestCard', () => ({
  ContestGrid: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ContestCard: ({ contest, href }: { contest: { title: string }; href?: string }) => (
    <a href={href}>{contest.title}</a>
  ),
}));

const BUSINESS = {
  id: 'biz-1',
  name: '주식회사 새모',
  type: '기업',
  verificationStatus: 'verified',
  displayStatus: '승인',
  detailStatus: '승인',
  bannerUrl: 'https://cdn.example.com/banner.png',
  logoUrl: 'https://cdn.example.com/logo.png',
  address: '서울시 강남구',
  phone: '02-1234-5678',
  email: 'biz@semochal.kr',
  contentBlocks: [{ type: 'text', content: { text: '안녕하세요' } }],
  createdAt: '2026-01-01T00:00:00.000Z',
};

const CHALLENGES = [
  {
    id: 'c-1',
    title: '새모 해커톤',
    status: 'published',
    category: '개발',
    startDate: '2026-10-01T00:00:00.000Z',
    endDate: '2099-10-31T00:00:00.000Z',
    posterUrl: 'https://cdn.example.com/poster.png',
  },
];

function mockQuery(overrides: Record<string, unknown>) {
  vi.mocked(generated.useGetPublicBusiness).mockReturnValue(overrides as never);
}

function mockChallengesQuery(overrides: Record<string, unknown>) {
  vi.mocked(generated.useGetPublicBusinessChallenges).mockReturnValue(overrides as never);
}

describe('PublicBusinessProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 기본적으로 챌린지 목록은 비어 있어 섹션이 숨겨진다.
    mockChallengesQuery({ isLoading: false, isError: false, data: { status: 200, data: [] } });
  });
  afterEach(() => cleanup());

  it('로딩 중에는 로딩 상태를 보여준다', () => {
    mockQuery({ isLoading: true, isError: false, data: undefined });
    render(<PublicBusinessProfilePage businessId="biz-1" />);
    expect(screen.getByRole('status').textContent).toBe('기업 정보를 불러오는 중이에요');
  });

  it('404 응답이면 기업을 찾을 수 없다는 화면을 보여준다', () => {
    mockQuery({ isLoading: false, isError: true, error: new ApiError(404, {}) });
    render(<PublicBusinessProfilePage businessId="biz-1" />);
    expect(screen.getByText('기업을 찾을 수 없어요')).not.toBeNull();
  });

  it('404가 아닌 오류면 다시 시도 안내를 보여준다', () => {
    mockQuery({ isLoading: false, isError: true, error: new ApiError(500, {}) });
    render(<PublicBusinessProfilePage businessId="biz-1" />);
    expect(screen.getByRole('alert').textContent).toContain('기업 정보를 불러오지 못했어요');
  });

  it('공개 프로필(기업명·인증 상태·연락처·소개)을 렌더한다', () => {
    mockQuery({ isLoading: false, isError: false, data: { status: 200, data: BUSINESS } });
    const { container } = render(<PublicBusinessProfilePage businessId="biz-1" />);
    expect(screen.getByText('주식회사 새모')).not.toBeNull();
    expect(screen.getByText('승인')).not.toBeNull();
    expect(screen.getByText('서울시 강남구')).not.toBeNull();
    expect(screen.getByText('02-1234-5678')).not.toBeNull();
    expect(screen.getByText('biz@semochal.kr')).not.toBeNull();
    expect(screen.getByText('안녕하세요')).not.toBeNull();
    // 배너/로고는 서버가 resolve한 공개 URL로 렌더된다.
    expect(container.querySelector(`img[src="${BUSINESS.bannerUrl}"]`)).not.toBeNull();
    expect(container.querySelector(`img[src="${BUSINESS.logoUrl}"]`)).not.toBeNull();
  });

  it('승인 상태면 기업명 옆에 파란 인증 체크를 표시한다', () => {
    mockQuery({ isLoading: false, isError: false, data: { status: 200, data: BUSINESS } });
    const { container } = render(<PublicBusinessProfilePage businessId="biz-1" />);
    expect(container.querySelector('img[alt="인증된 기관"]')).not.toBeNull();
  });

  it('승인이 아니면 인증 체크를 표시하지 않는다', () => {
    mockQuery({
      isLoading: false,
      isError: false,
      data: {
        status: 200,
        data: { ...BUSINESS, displayStatus: '가승인', detailStatus: '인증 대기' },
      },
    });
    const { container } = render(<PublicBusinessProfilePage businessId="biz-1" />);
    expect(container.querySelector('img[alt="인증된 기관"]')).toBeNull();
  });

  it('contentBlocks가 비어 있으면 소개 섹션을 렌더하지 않는다', () => {
    mockQuery({
      isLoading: false,
      isError: false,
      data: { status: 200, data: { ...BUSINESS, contentBlocks: [] } },
    });
    render(<PublicBusinessProfilePage businessId="biz-1" />);
    expect(screen.queryByText('소개')).toBeNull();
  });

  it('이 기관의 챌린지 목록을 카드 링크로 렌더한다', () => {
    mockQuery({ isLoading: false, isError: false, data: { status: 200, data: BUSINESS } });
    mockChallengesQuery({
      isLoading: false,
      isError: false,
      data: { status: 200, data: CHALLENGES },
    });
    render(<PublicBusinessProfilePage businessId="biz-1" />);
    expect(screen.getByText('이 기관의 챌린지')).not.toBeNull();
    const link = screen.getByRole('link', { name: '새모 해커톤' });
    expect(link.getAttribute('href')).toBe('/contests/c-1');
  });

  it('공개 챌린지가 없으면 챌린지 섹션을 숨긴다', () => {
    mockQuery({ isLoading: false, isError: false, data: { status: 200, data: BUSINESS } });
    // beforeEach의 빈 목록 기본값을 그대로 둔다.
    render(<PublicBusinessProfilePage businessId="biz-1" />);
    expect(screen.queryByText('이 기관의 챌린지')).toBeNull();
  });
});
