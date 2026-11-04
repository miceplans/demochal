import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@emotion/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { theme } from '@/styles/theme';
import { ToastProvider } from '@/components/common/Toast';
import { ReportLogTable } from '../components/ReportLogTable';

vi.mock('@semochal/api-client', () => ({
  generated: {
    useListAdminReports: () => ({ data: undefined, isError: false, refetch: vi.fn() }),
    useResolveReport: () => ({ isPending: false, mutate: vi.fn() }),
    getListAdminReportsQueryKey: vi.fn(),
    getGetAdminDashboardQueryKey: vi.fn(),
  },
}));

const report = {
  id: 'r1',
  content: '세모팀',
  targetType: 'team',
  org: '세모기관',
  summary: '스팸 의심',
  detail: '상세 신고 내용',
  reporter: '김수아',
  reportedAt: '2026-10-02T00:00:00.000Z',
  status: 'open',
} as const;

function renderTable() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider theme={theme}>
        <ToastProvider>
          <ReportLogTable reports={[report]} />
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

describe('ReportLogTable 신고자', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(cleanup);

  it('신고 상세의 신고자를 기본 마스킹 상태에서 호버/포커스로 원본이 노출되는 MaskedText로 표시한다', () => {
    renderTable();

    fireEvent.click(screen.getByText('세모팀'));
    const panel = screen.getByRole('complementary', { name: '세모팀 신고 상세' });

    const masked = within(panel).getByText('김*아');
    expect(masked).not.toBeNull();
    // 공통 MaskedText가 원본 '김수아'를 가진 채 호버/포커스 노출 약속(title)을 제공한다.
    const root = masked.closest('[title]');
    expect(root?.getAttribute('title')).toBe('호버 또는 포커스 시 전체를 확인할 수 있습니다');
    expect(root?.getAttribute('aria-label')).toContain('김수아');
    expect(within(panel).getByText('신고자')).not.toBeNull();
  });
});
