import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BizPostingsPage } from './BizPostingsPage';

const mocks = vi.hoisted(() => ({
  hasPosting: true,
  hrefOf: vi.fn((path: string) => `/biz${path}`),
}));

vi.mock('@semochal/api-client', () => ({
  generated: {
    useListMyChallenges: () => ({
      data: mocks.hasPosting
        ? {
            status: 200,
            data: {
              items: [
                {
                  id: 'ch-1',
                  title: '해커톤',
                  organizer: '세모챌',
                  startDate: new Date(Date.now() - 86_400_000).toISOString(),
                  endDate: new Date(Date.now() + 86_400_000).toISOString(),
                  thumbnailUrl: null,
                  posterUrl: null,
                },
              ],
            },
          }
        : undefined,
      isPending: false,
      isError: false,
    }),
    useGetMyChallengeStats: () => ({ data: undefined, isPending: false, isError: false }),
  },
}));
vi.mock('@/components/biz/BizShell', () => ({
  BizContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BizLink: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={mocks.hrefOf(href)}>{children}</a>
  ),
  OutlineButton: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  PrimaryButton: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
  SectionHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SectionTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  StatBox: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useBizHref: () => mocks.hrefOf,
}));
vi.mock('@/components/biz/ExposureChart', () => ({ ExposureChart: () => null }));

describe('BizPostingsPage 지원자 관리 진입점', () => {
  afterEach(() => {
    cleanup();
    mocks.hasPosting = true;
    mocks.hrefOf.mockClear();
  });

  it('공고가 있으면 섹션 헤더의 지원자 관리가 /applications 링크로 렌더된다', () => {
    render(<BizPostingsPage />);
    expect(screen.getByRole('link', { name: '지원자 관리' }).getAttribute('href')).toBe(
      '/biz/applications',
    );
    expect(mocks.hrefOf).toHaveBeenCalledWith('/applications');
  });

  it('공고가 없어도 빈 상태의 지원자 관리가 /applications 링크로 렌더된다', () => {
    mocks.hasPosting = false;
    render(<BizPostingsPage />);
    expect(screen.getByText('등록된 공고가 없습니다.')).toBeTruthy();
    expect(screen.getByRole('link', { name: '지원자 관리' }).getAttribute('href')).toBe(
      '/biz/applications',
    );
    expect(mocks.hrefOf).toHaveBeenCalledWith('/applications');
  });
});
