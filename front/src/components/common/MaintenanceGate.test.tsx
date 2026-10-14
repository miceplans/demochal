import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ApiError, generated } from '@semochal/api-client';
import { ToastProvider } from './Toast';
import { MaintenanceGate } from './MaintenanceGate';

vi.mock('next/link', () => ({
  default: ({ children, ...props }: { children: ReactNode } & Record<string, unknown>) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock('@semochal/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@semochal/api-client')>();
  return { ...actual, generated: { listChallenges: vi.fn() } };
});

const listChallengesMock = vi.mocked(generated.listChallenges);

/** 쿼리 한 번당 한 번 실패하는 테스트용 페이지 — maintenance 진입/복귀를 모두 확인한다. */
function QueryPage({ error }: { error: Error }) {
  const { data } = useQuery({
    queryKey: ['maintenance-gate-test'],
    queryFn: async () => {
      throw error;
    },
    retry: false,
  });
  return <div data-testid="page-content">{String(data)}</div>;
}

function renderGate(children: ReactNode) {
  return render(
    <ToastProvider>
      <MaintenanceGate>{children}</MaintenanceGate>
    </ToastProvider>,
  );
}

describe('MaintenanceGate', () => {
  beforeEach(() => {
    listChallengesMock.mockReset();
  });
  afterEach(cleanup);

  it('503 쿼리 실패 시 점검 화면으로 전환하고 전역 에러 토스트를 띄우지 않는다', async () => {
    listChallengesMock.mockRejectedValue(
      new ApiError(503, { message: '서비스 점검 중입니다. 잠시 후 다시 이용해 주세요.' }),
    );
    renderGate(<QueryPage error={new ApiError(503, { message: '서비스 점검 중입니다.' })} />);

    expect(await screen.findByRole('heading', { name: '서버 점검 중입니다.' })).toBeTruthy();
    expect(screen.queryByTestId('page-content')).toBeNull();
    expect(screen.queryByText('요청이 실패했어요')).toBeNull();
  });

  it('503이 아닌 쿼리 실패(500)에서는 점검 화면으로 전환하지 않고 토스트로 안내한다', async () => {
    renderGate(<QueryPage error={new ApiError(500, { message: '서버 오류' })} />);

    expect(await screen.findByText('요청이 실패했어요')).toBeTruthy();
    expect(screen.getByTestId('page-content')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: '서버 점검 중입니다.' })).toBeNull();
  });

  it('점검 화면 노출 중 탐침이 성공하면 정상 화면으로 자동 복귀한다', async () => {
    let failed = true;
    function FlakyPage() {
      const { data } = useQuery({
        queryKey: ['maintenance-recovery-test'],
        queryFn: async () => {
          if (failed) {
            failed = false;
            throw new ApiError(503, { message: '서비스 점검 중입니다.' });
          }
          return 'recovered';
        },
        retry: false,
      });
      return <div data-testid="page-content">{String(data)}</div>;
    }
    listChallengesMock.mockResolvedValue({ data: { items: [] }, status: 200 } as never);
    renderGate(<FlakyPage />);

    expect(await screen.findByRole('heading', { name: '서버 점검 중입니다.' })).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('page-content').textContent).toBe('recovered'));
    expect(screen.queryByRole('heading', { name: '서버 점검 중입니다.' })).toBeNull();
    expect(listChallengesMock).toHaveBeenCalledWith({ limit: 1 });
  });

  it('탐침이 계속 503이면 점검 화면을 유지한다', async () => {
    listChallengesMock.mockRejectedValue(new ApiError(503, { message: '점검 중' }));
    renderGate(<QueryPage error={new ApiError(503, { message: '서비스 점검 중입니다.' })} />);

    expect(await screen.findByRole('heading', { name: '서버 점검 중입니다.' })).toBeTruthy();
    await waitFor(() => expect(listChallengesMock).toHaveBeenCalled());
    expect(screen.getByRole('heading', { name: '서버 점검 중입니다.' })).toBeTruthy();
  });
});
