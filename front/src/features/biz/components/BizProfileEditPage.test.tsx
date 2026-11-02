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
    onMapChange,
  }: {
    name?: React.ReactNode;
    address?: React.ReactNode;
    phone?: React.ReactNode;
    email?: React.ReactNode;
    onMapChange?: (latitude: number, longitude: number) => void;
  }) => (
    <div>
      {name}
      {address}
      {phone}
      {email}
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

  it('저장된 지도 좌표를 위도·경도 입력에 보여준다', () => {
    render(<BizProfileEditPage />);
    expect((screen.getByLabelText('지도 위도') as HTMLInputElement).value).toBe('37.5665');
    expect((screen.getByLabelText('지도 경도') as HTMLInputElement).value).toBe('126.978');
  });

  it('지도 조정(콜백·좌표 입력)한 위치를 저장에 포함한다', async () => {
    mocks.updateBusiness.mockResolvedValue({ status: 200, data: {} });
    const user = userEvent.setup();
    render(<BizProfileEditPage />);

    await user.click(screen.getByRole('button', { name: '지도 핀 이동 시뮬레이션' }));
    expect((screen.getByLabelText('지도 위도') as HTMLInputElement).value).toBe('36.5');

    fireEvent.change(screen.getByLabelText('지도 경도'), { target: { value: '128.1' } });
    await user.click(screen.getByRole('button', { name: '저장' }));

    await waitFor(() =>
      expect(mocks.updateBusiness).toHaveBeenCalledWith({
        id: 'business-1',
        data: expect.objectContaining({
          mapLatitude: 36.5,
          mapLongitude: 128.1,
        }),
      }),
    );
  });

  it('좌표를 비우고 저장하면 null로 본문에 담아 핀을 제거한다', async () => {
    mocks.updateBusiness.mockResolvedValue({ status: 200, data: {} });
    const user = userEvent.setup();
    render(<BizProfileEditPage />);

    fireEvent.change(screen.getByLabelText('지도 위도'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('지도 경도'), { target: { value: '' } });
    await user.click(screen.getByRole('button', { name: '저장' }));

    await waitFor(() =>
      expect(mocks.updateBusiness).toHaveBeenCalledWith({
        id: 'business-1',
        data: expect.objectContaining({ mapLatitude: null, mapLongitude: null }),
      }),
    );
  });

  it('현재 위치 사용 버튼은 브라우저 위치 정보를 좌표 입력에 채운다', async () => {
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
    expect((screen.getByLabelText('지도 위도') as HTMLInputElement).value).toBe('35.2');
    expect((screen.getByLabelText('지도 경도') as HTMLInputElement).value).toBe('129.1');
  });

  describe('주소 검색(JS API 키 설정 환경)', () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = 'test-key';
    });

    it('검색 성공 시 지오코딩 좌표가 위도·경도 입력에 반영된다', async () => {
      mocks.searchAddress.mockResolvedValue({ latitude: 37.4, longitude: 127.1 });
      const user = userEvent.setup();
      render(<BizProfileEditPage />);

      await user.type(screen.getByLabelText('지도 주소 검색'), '서울시 중구 세종대로 110');
      await user.click(screen.getByRole('button', { name: '검색' }));

      expect(mocks.searchAddress).toHaveBeenCalledWith('test-key', '서울시 중구 세종대로 110');
      await waitFor(() =>
        expect((screen.getByLabelText('지도 위도') as HTMLInputElement).value).toBe('37.4'),
      );
      expect((screen.getByLabelText('지도 경도') as HTMLInputElement).value).toBe('127.1');
    });

    it('검색 실패(결과 없음)는 에러 토스트를 띄우고 기존 좌표를 유지한다', async () => {
      mocks.searchAddress.mockResolvedValue(null);
      const user = userEvent.setup();
      render(<BizProfileEditPage />);

      await user.type(screen.getByLabelText('지도 주소 검색'), '아묻따 없는 주소');
      await user.click(screen.getByRole('button', { name: '검색' }));

      await waitFor(() => expect(mocks.toastError).toHaveBeenCalled());
      expect((screen.getByLabelText('지도 위도') as HTMLInputElement).value).toBe('37.5665');
      expect((screen.getByLabelText('지도 경도') as HTMLInputElement).value).toBe('126.978');
    });

    it('키가 없으면 주소 검색 입력이 보이지 않는다', () => {
      delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      render(<BizProfileEditPage />);
      expect(screen.queryByLabelText('지도 주소 검색')).toBeNull();
    });
  });
});
