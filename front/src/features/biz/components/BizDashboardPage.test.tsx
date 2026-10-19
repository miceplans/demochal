import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BizDashboardPage } from './BizDashboardPage';

const mocks = vi.hoisted(() => ({ posterUrl: null as string | null, hasPosting: true }));

vi.mock('@semochal/api-client', () => ({
  generated: {
    useGetBizDashboard: () => ({
      data: {
        data: {
          recentPosting: mocks.hasPosting
            ? { title: '최근 공고', posterUrl: mocks.posterUrl }
            : null,
          paymentTotal: 0,
          activeAds: [],
        },
      },
      isError: false,
    }),
    useListPaymentCards: () => ({ data: { data: [] } }),
  },
}));
vi.mock('@/components/biz/BizShell', () => ({
  BizContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BizLink: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  SectionHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SectionTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  StatusTag: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));
vi.mock('@/components/biz/BizPaymentCard', () => ({ BizPaymentCard: () => null }));
vi.mock('@/components/biz/ExposureChart', () => ({ ExposureChart: () => null }));

describe('BizDashboardPage 포스터', () => {
  afterEach(() => {
    cleanup();
    mocks.posterUrl = null;
    mocks.hasPosting = true;
  });

  it('최근 공고의 포스터 URL을 이미지로 렌더한다', () => {
    mocks.posterUrl = 'https://cdn.example.com/poster.webp';
    const { container } = render(<BizDashboardPage />);
    expect(
      container.querySelector('img[src="https://cdn.example.com/poster.webp"]'),
    ).not.toBeNull();
    expect(screen.getByText('최근 공고')).toBeTruthy();
  });

  it('URL이 없으면 이미지 없이 기존 썸네일을 유지한다', () => {
    const { container } = render(<BizDashboardPage />);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('최근 공고')).toBeTruthy();
  });

  it('공고가 없어도 빈 상태를 유지한다', () => {
    mocks.hasPosting = false;
    const { container } = render(<BizDashboardPage />);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('등록된 공고가 없어요.')).toBeTruthy();
  });
});
