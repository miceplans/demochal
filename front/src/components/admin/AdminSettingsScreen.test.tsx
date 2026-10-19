import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { generated } from '@semochal/api-client';
import { ToastProvider } from '@/components/common/Toast';
import { AdminSettingsScreen } from './AdminSettingsScreen';

vi.mock('@semochal/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@semochal/api-client')>();
  return {
    ...actual,
    generated: {
      useGetAdminSettings: vi.fn(),
      useUpdateAdminSettings: vi.fn(),
      getGetAdminSettingsQueryKey: vi.fn(() => ['/admin/settings']),
    },
  };
});

vi.mock('./parts', () => ({
  AdminPageTitle: ({ children }: { children: ReactNode }) => <h1>{children}</h1>,
  ApproveButton: ({ children, ...props }: { children: ReactNode }) => (
    <button {...props}>{children}</button>
  ),
}));

const useGetAdminSettingsMock = vi.mocked(generated.useGetAdminSettings);
const useUpdateAdminSettingsMock = vi.mocked(generated.useUpdateAdminSettings);
const mutateMock = vi.fn();

type MutationConfig = {
  mutation?: {
    onSuccess?: (response: unknown, variables: { data: Record<string, unknown> }) => void;
    onError?: () => void;
  };
};

type MaintenanceState = { startAt: string | null; endAt: string | null; active: boolean };

const baseSettings = {
  profile: {
    name: '관리자',
    role: '관리자',
    email: 'admin@example.com',
    twoFactorEnabled: false,
  },
  groups: [
    {
      title: '서비스 설정',
      rows: [
        { key: 'bizAutoApprove', label: '기관 가입 자동 승인', description: '자동 승인합니다.' },
      ],
    },
  ],
  values: {
    bizAutoApprove: false,
    contestAutoPublish: false,
    reportAlert: true,
    newBusinessAlert: false,
  },
  maintenance: { startAt: null, endAt: null, active: false } as MaintenanceState,
};

function settingsWith(maintenance: Partial<MaintenanceState>) {
  return { ...baseSettings, maintenance: { ...baseSettings.maintenance, ...maintenance } };
}

function renderScreen() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <ToastProvider>
        <AdminSettingsScreen />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe('AdminSettingsScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useGetAdminSettingsMock.mockReturnValue({
      data: { data: baseSettings },
    } as never);
    useUpdateAdminSettingsMock.mockImplementation((_config?: unknown) => {
      return { mutate: mutateMock, isPending: false } as never;
    });
  });

  afterEach(cleanup);

  it('서버의 점검 기간을 입력값에 표시하고 진행 중 상태를 보여준다', () => {
    useGetAdminSettingsMock.mockReturnValue({
      data: {
        data: settingsWith({
          startAt: '2026-10-19T00:00:00.000Z',
          endAt: '2099-10-19T06:00:00.000Z',
          active: true,
        }),
      },
    } as never);

    renderScreen();

    expect(screen.getByLabelText('점검 시작 시각')).toHaveProperty(
      'value',
      toLocalValue('2026-10-19T00:00:00.000Z'),
    );
    expect(screen.getByLabelText('점검 종료 시각')).toHaveProperty(
      'value',
      toLocalValue('2099-10-19T06:00:00.000Z'),
    );
    expect(screen.getByText('점검 진행 중')).toBeTruthy();
    // 아직 변경분이 없으면 저장 버튼은 비활성이다.
    expect(screen.getByRole('button', { name: '저장하기' })).toHaveProperty('disabled', true);
  });

  it('점검 기간을 입력하고 저장하면 ISO 페이로드가 전송된다', async () => {
    const user = userEvent.setup();
    renderScreen();

    fireEvent.change(screen.getByLabelText('점검 시작 시각'), {
      target: { value: '2099-01-01T02:00' },
    });
    fireEvent.change(screen.getByLabelText('점검 종료 시각'), {
      target: { value: '2099-01-01T04:00' },
    });
    await user.click(screen.getByRole('button', { name: '저장하기' }));

    expect(mutateMock).toHaveBeenCalledWith({
      data: {
        maintenanceStartAt: new Date('2099-01-01T02:00').toISOString(),
        maintenanceEndAt: new Date('2099-01-01T04:00').toISOString(),
      },
    });
  });

  it('토글 변경분과 점검 기간 변경분이 함께 저장된다', async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.click(screen.getByRole('switch', { name: '기관 가입 자동 승인' }));
    fireEvent.change(screen.getByLabelText('점검 시작 시각'), {
      target: { value: '2099-03-03T01:00' },
    });
    await user.click(screen.getByRole('button', { name: '저장하기' }));

    expect(mutateMock).toHaveBeenCalledWith({
      data: {
        bizAutoApprove: true,
        maintenanceStartAt: new Date('2099-03-03T01:00').toISOString(),
      },
    });
  });

  it('시작 시각이 종료 시각보다 같거나 늦으면 저장하지 않고 안내한다', async () => {
    const user = userEvent.setup();
    renderScreen();

    fireEvent.change(screen.getByLabelText('점검 시작 시각'), {
      target: { value: '2099-01-01T05:00' },
    });
    fireEvent.change(screen.getByLabelText('점검 종료 시각'), {
      target: { value: '2099-01-01T04:00' },
    });
    await user.click(screen.getByRole('button', { name: '저장하기' }));

    expect(mutateMock).not.toHaveBeenCalled();
    expect(screen.getByText('점검 시작 시각은 종료 시각보다 이전이어야 해요')).toBeTruthy();
  });

  it('기간 입력을 비우고 저장하면 null로 초기화된다', async () => {
    const user = userEvent.setup();
    useGetAdminSettingsMock.mockReturnValue({
      data: {
        data: settingsWith({
          startAt: '2026-10-19T00:00:00.000Z',
          endAt: '2099-10-19T06:00:00.000Z',
        }),
      },
    } as never);
    renderScreen();

    fireEvent.change(screen.getByLabelText('점검 시작 시각'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('점검 종료 시각'), { target: { value: '' } });
    await user.click(screen.getByRole('button', { name: '저장하기' }));

    expect(mutateMock).toHaveBeenCalledWith({
      data: { maintenanceStartAt: null, maintenanceEndAt: null },
    });
  });

  it('저장 성공 시 캐시를 갱신하고 전송한 변경분을 pending에서 제거한다', async () => {
    const user = userEvent.setup();
    let capturedConfig: MutationConfig | undefined;
    useUpdateAdminSettingsMock.mockImplementation((config?: unknown) => {
      capturedConfig = config as MutationConfig;
      return { mutate: mutateMock, isPending: false } as never;
    });
    const { container } = renderScreen();

    fireEvent.change(screen.getByLabelText('점검 시작 시각'), {
      target: { value: '2099-06-06T02:00' },
    });
    await user.click(screen.getByRole('button', { name: '저장하기' }));

    const payload = {
      maintenanceStartAt: new Date('2099-06-06T02:00').toISOString(),
    };
    expect(mutateMock).toHaveBeenCalledWith({ data: payload });

    const submitButton = screen.getByRole('button', { name: '저장하기' });
    expect(submitButton).toHaveProperty('disabled', false);
    await act(async () => {
      capturedConfig?.mutation?.onSuccess?.({ data: baseSettings }, { data: payload });
    });

    // 전송한 변경분이 pending에서 빠져 저장 버튼이 다시 비활성이 된다.
    expect(container.querySelector('button[disabled]')).toBeTruthy();
  });
});

/** ISO 문자열을 테스트 환경 로컬 시간대의 datetime-local 값으로 바꾼다. */
function toLocalValue(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}
