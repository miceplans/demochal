import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BizProfileEditPage } from './BizProfileEditPage';

const mocks = vi.hoisted(() => {
  const business = {
    id: 'business-1',
    name: '세모챌',
    address: '서울특별시',
    phone: '02-0000-0000',
    email: 'biz@example.com',
    mapLatitude: 37.5665,
    mapLongitude: 126.978,
  };
  return {
    business,
    updateBusiness: vi.fn(),
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
    searchAddress: vi.fn(),
  };
});

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock('@semochal/api-client', () => ({
  generated: {
    useFindMyBusiness: () => ({
      data: { status: 200, data: mocks.business },
      isError: false,
      isPending: false,
    }),
    useGetFile: () => ({ data: undefined }),
    useRequestPresignedUpload: () => ({ mutateAsync: vi.fn() }),
    useFinalizeUpload: () => ({ mutateAsync: vi.fn() }),
    useUpdateBusiness: () => ({ mutateAsync: mocks.updateBusiness, isPending: false }),
    getFindMyBusinessQueryKey: () => ['business'],
  },
}));
vi.mock('@/components/biz/BizShell', () => ({
  BizContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  OutlineButton: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
  PrimaryButton: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
  useBizHref: () => (path: string) => path,
}));
vi.mock('@/components/biz/BizOrgProfile', () => ({
  BizOrgProfile: ({
    name,
    address,
    phone,
    email,
    mapLatitude,
    mapLongitude,
    onMapChange,
  }: {
    name?: React.ReactNode;
    address?: React.ReactNode;
    phone?: React.ReactNode;
    email?: React.ReactNode;
    mapLatitude?: number | null;
    mapLongitude?: number | null;
    onMapChange?: (latitude: number, longitude: number) => void;
  }) => (
    <div>
      {name}
      {address}
      {phone}
      {email}
      <span data-testid="map-coords">
        {mapLatitude ?? 'null'},{mapLongitude ?? 'null'}
      </span>
      <button type="button" onClick={() => onMapChange?.(36.5, 127.5)}>
        지도 핀 이동 시뮬레이션
      </button>
    </div>
  ),
}));
vi.mock('@/components/common/Toast', () => ({
  useToast: () => ({ success: mocks.toastSuccess, error: mocks.toastError }),
}));
vi.mock('@/lib/google-maps', () => ({
  searchAddress: mocks.searchAddress,
}));

describe('BizProfileEditPage', () => {
  afterEach(cleanup);
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    // 저장 성공 후 페이지 이동(window.location.href 할당)이 jsdom 에러를 내지 않게 스텁한다.
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { href: '' },
    });
  });

  it('renders every profile field with a visible default border', () => {
    render(<BizProfileEditPage />);

    for (const label of ['기업명', '주소', '전화번호', '이메일']) {
      const field = screen.getByLabelText(label);
      expect(getComputedStyle(field).borderColor).not.toBe('transparent');
    }
  });

  it('위도·경도 입력은 화면에 노출되지 않는다', () => {
    render(<BizProfileEditPage />);
    expect(screen.queryByLabelText('지도 위도')).toBeNull();
    expect(screen.queryByLabelText('지도 경도')).toBeNull();
  });

  it('저장된 지도 좌표를 초기화해 지도에 반영한다', () => {
    render(<BizProfileEditPage />);
    expect(screen.getByTestId('map-coords').textContent).toBe('37.5665,126.978');
  });

  it('지도 핀 조정(드래그/클릭 콜백)한 위치를 저장에 포함한다', async () => {
    mocks.updateBusiness.mockResolvedValue({ status: 200, data: {} });
    const user = userEvent.setup();
    render(<BizProfileEditPage />);

    await user.click(screen.getByRole('button', { name: '지도 핀 이동 시뮬레이션' }));
    expect(screen.getByTestId('map-coords').textContent).toBe('36.5,127.5');

    await user.click(screen.getByRole('button', { name: '저장' }));

    await waitFor(() =>
      expect(mocks.updateBusiness).toHaveBeenCalledWith({
        id: 'business-1',
        data: expect.objectContaining({
          mapLatitude: 36.5,
          mapLongitude: 127.5,
        }),
      }),
    );
  });

  it('현재 위치 사용 버튼은 브라우저 위치 정보를 지도에 채우고 주소 입력은 바꾸지 않는다', async () => {
    const getCurrentPosition = vi.fn((success: PositionCallback) =>
      success({
        coords: { latitude: 35.2, longitude: 129.1 },
      } as GeolocationPosition),
    );
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition },
    });
    const user = userEvent.setup();
    render(<BizProfileEditPage />);

    await user.click(screen.getByRole('button', { name: '현재 위치 사용' }));

    expect(getCurrentPosition).toHaveBeenCalled();
    expect(screen.getByTestId('map-coords').textContent).toBe('35.2,129.1');
    expect((screen.getByLabelText('주소') as HTMLInputElement).value).toBe('서울특별시');
  });

  describe('주소 검색(JS API 키 설정 환경)', () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = 'test-key';
    });
    afterEach(() => {
      delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    });

    it('검색 성공 시 지오코딩 좌표가 지도에 반영된다', async () => {
      mocks.searchAddress.mockResolvedValue({ latitude: 37.4, longitude: 127.1 });
      const user = userEvent.setup();
      render(<BizProfileEditPage />);

      await user.type(screen.getByLabelText('지도 주소 검색'), '서울시 중구 세종대로 110');
      await user.click(screen.getByRole('button', { name: '검색' }));

      expect(mocks.searchAddress).toHaveBeenCalledWith('test-key', '서울시 중구 세종대로 110');
      await waitFor(() => expect(screen.getByTestId('map-coords').textContent).toBe('37.4,127.1'));
    });

    it('검색 실패(결과 없음)는 에러 토스트를 띄우고 기존 좌표를 유지한다', async () => {
      mocks.searchAddress.mockResolvedValue(null);
      const user = userEvent.setup();
      render(<BizProfileEditPage />);

      await user.type(screen.getByLabelText('지도 주소 검색'), '아묻따 없는 주소');
      await user.click(screen.getByRole('button', { name: '검색' }));

      await waitFor(() => expect(mocks.toastError).toHaveBeenCalled());
      expect(screen.getByTestId('map-coords').textContent).toBe('37.5665,126.978');
    });

    it('주소 입력이 비어 있으면 검색 성공 시 검색한 주소가 자동 입력된다', async () => {
      mocks.searchAddress.mockResolvedValue({ latitude: 37.4, longitude: 127.1 });
      mocks.updateBusiness.mockResolvedValue({ status: 200, data: {} });
      const user = userEvent.setup();
      render(<BizProfileEditPage />);

      fireEvent.change(screen.getByLabelText('주소'), { target: { value: '' } });
      await user.type(screen.getByLabelText('지도 주소 검색'), '서울시 중구 세종대로 110');
      await user.click(screen.getByRole('button', { name: '검색' }));

      await waitFor(() =>
        expect((screen.getByLabelText('주소') as HTMLInputElement).value).toBe(
          '서울시 중구 세종대로 110',
        ),
      );

      // 저장에도 자동 입력된 주소가 그대로 반영된다.
      await user.click(screen.getByRole('button', { name: '저장' }));
      await waitFor(() =>
        expect(mocks.updateBusiness).toHaveBeenCalledWith({
          id: 'business-1',
          data: expect.objectContaining({ address: '서울시 중구 세종대로 110' }),
        }),
      );
    });

    it('주소 입력에 값이 있으면 검색이 그 값을 덮어쓰지 않는다', async () => {
      mocks.searchAddress.mockResolvedValue({ latitude: 37.4, longitude: 127.1 });
      const user = userEvent.setup();
      render(<BizProfileEditPage />);

      fireEvent.change(screen.getByLabelText('주소'), {
        target: { value: '부산광역시 해울대구' },
      });
      await user.type(screen.getByLabelText('지도 주소 검색'), '서울시 중구 세종대로 110');
      await user.click(screen.getByRole('button', { name: '검색' }));

      await waitFor(() => expect(screen.getByTestId('map-coords').textContent).toBe('37.4,127.1'));
      expect((screen.getByLabelText('주소') as HTMLInputElement).value).toBe('부산광역시 해울대구');
    });

    it('키가 없으면 주소 검색 입력이 보이지 않는다', () => {
      delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      render(<BizProfileEditPage />);
      expect(screen.queryByLabelText('지도 주소 검색')).toBeNull();
    });
  });
});
