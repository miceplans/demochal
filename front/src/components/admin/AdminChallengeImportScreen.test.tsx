import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@/components/common/Toast';
import { AdminChallengeImportScreen } from './AdminChallengeImportScreen';

const mocks = vi.hoisted(() => ({ importChallenge: vi.fn() }));

vi.mock('./AdminShell', () => ({
  useAdminHref: () => (path: string) => `/admin${path}`,
}));

vi.mock('@semochal/api-client', () => ({
  generated: {
    useRequestPresignedUpload: () => ({ mutateAsync: vi.fn() }),
    useFinalizeUpload: () => ({ mutateAsync: vi.fn() }),
    useImportAdminChallenge: () => ({ mutateAsync: mocks.importChallenge }),
    getListAdminContentsQueryKey: () => ['/admin/contents'],
  },
  getApiErrorMessage: (error: unknown) =>
    (error as { body?: { message?: string } })?.body?.message ?? null,
}));

function renderScreen() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <ToastProvider>
        <AdminChallengeImportScreen />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

const item = {
  title: '대학생 서포터즈 10기',
  category: '대외활동',
  host: 'OO재단',
  endDate: '2099-12-10',
  recruitUrl: 'https://example.org',
  description: '활동 내용',
};

afterEach(() => {
  cleanup();
  mocks.importChallenge.mockReset();
});

describe('AdminChallengeImportScreen', () => {
  it('validates pasted JSON and publishes valid rows without a poster', async () => {
    const user = userEvent.setup();
    mocks.importChallenge.mockResolvedValue({
      status: 201,
      data: {
        challenge: { id: 'ch-1' },
        business: { id: 'biz-1', name: 'OO재단', created: true },
      },
    });
    renderScreen();

    const textarea = screen.getByLabelText('공고 정보 JSON');
    await user.click(textarea);
    await user.paste(JSON.stringify([item, { title: '오류 공고' }]));
    await user.click(screen.getByRole('button', { name: '검증하기' }));

    expect(screen.getByText('host(주최)는 필수예요. 이 이름의 기업 명의로 등록돼요.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '1건 등록하기' }));

    expect(mocks.importChallenge).toHaveBeenCalledTimes(1);
    expect(mocks.importChallenge.mock.calls[0]![0].data).toMatchObject({
      title: item.title,
      host: 'OO재단',
      endDate: '2099-12-10T23:59:59+09:00',
    });
    expect(await screen.findByText(/기업 새로 생성/)).toBeTruthy();
    expect(screen.getByRole('link', { name: '보기' }).getAttribute('href')).toBe(
      '/admin/contents/challenges/ch-1',
    );
  });

  it('shows the server error message on a failed row', async () => {
    const user = userEvent.setup();
    mocks.importChallenge.mockRejectedValue({
      body: { message: '이미 같은 제목의 공고가 있습니다.' },
    });
    renderScreen();

    await user.click(screen.getByLabelText('공고 정보 JSON'));
    await user.paste(JSON.stringify(item));
    await user.click(screen.getByRole('button', { name: '검증하기' }));
    await user.click(screen.getByRole('button', { name: '1건 등록하기' }));

    expect(await screen.findByText('이미 같은 제목의 공고가 있습니다.')).toBeTruthy();
  });

  it('shows a parse error for invalid JSON', async () => {
    const user = userEvent.setup();
    renderScreen();
    await user.click(screen.getByLabelText('공고 정보 JSON'));
    await user.paste('{');
    await user.click(screen.getByRole('button', { name: '검증하기' }));
    expect(screen.getByRole('alert').textContent).toContain('JSON');
  });
});
