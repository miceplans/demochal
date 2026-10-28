import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@emotion/react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BizAdsPage } from './BizAdsPage';
import { theme } from '@/styles/theme';

type TestAd = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  paidAmount: number;
  status: 'active' | 'paused';
  imageUrl: string | null;
};

const mocks = vi.hoisted(() => ({
  ads: [] as TestAd[],
  createAd: vi.fn(),
  updateAd: vi.fn(),
  routerPush: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  fetchMock: vi.fn(),
  requestPayment: vi.fn(),
  cancelOrder: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.routerPush }) }));

const products = [
  {
    id: 'hero',
    name: '홈 히어로 배너',
    placement: 'hero',
    dailyPrice: 100000,
    reservedPeriods: [],
  },
  {
    id: 'gallery',
    name: '갤러리 노출',
    placement: 'gallery',
    dailyPrice: 50000,
    reservedPeriods: [],
  },
];

vi.mock('@semochal/api-client', () => ({
  generated: {
    useListMyAds: () => ({
      data: { status: 200, data: mocks.ads },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    }),
    useUpdateAd: () => ({ mutateAsync: mocks.updateAd }),
    useCreateAd: () => ({ mutateAsync: mocks.createAd }),
    useRequestPresignedUpload: () => ({
      mutateAsync: vi.fn(async () => ({
        data: { uploadUrl: 'https://upload.example', fileId: 'file-1' },
      })),
    }),
    useFinalizeUpload: () => ({ mutateAsync: vi.fn(async () => undefined) }),
    useListMyNotifications: () => ({ data: { data: [] } }),
    useListAdProducts: () => ({ data: { status: 200, data: products } }),
    listAdProducts: vi.fn(async () => ({ data: products })),
    getListMyAdsQueryKey: () => ['my-ads'],
  },
}));

vi.mock('@/lib/image-compression', () => ({
  AD_IMAGE_PRESETS: {
    hero: { initialQuality: 0.8, maxSizeMB: 0.3, maxWidthOrHeight: 1920 },
    gallery: { initialQuality: 0.8, maxSizeMB: 0.15, maxWidthOrHeight: 900 },
  },
  CROPPED_AD_IMAGE_PRESETS: {
    hero: { initialQuality: 0.95, maxSizeMB: 1, maxWidthOrHeight: 2400 },
    gallery: { initialQuality: 0.95, maxSizeMB: 0.5, maxWidthOrHeight: 1200 },
  },
  compressToWebP: vi.fn(async () => ({
    file: new File(['webp'], 'ad.webp', { type: 'image/webp' }),
    previewUrl: 'blob:preview',
    originalSize: 1000,
    compressedSize: 500,
  })),
  formatBytes: (size: number) => `${size}B`,
}));

vi.mock('@/lib/api-error', () => ({
  apiErrorMessage: (_: unknown, fallback: string) => fallback,
}));

vi.mock('@/lib/payments', () => ({ requestTossPayment: mocks.requestPayment }));
vi.mock('@/lib/ad-api', () => ({ adApi: { orders: { cancel: mocks.cancelOrder } } }));

vi.mock('@/components/common/Toast', () => ({
  useToast: () => ({ success: mocks.toastSuccess, error: mocks.toastError }),
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

vi.mock('@/components/ads/AdPlacementPreview', () => ({
  AdPlacementPreview: ({
    onImagePicked,
    processing,
  }: {
    onImagePicked?: (placement: 'hero' | 'gallery', file: File) => void;
    processing?: boolean;
  }) => (
    <>
      {(['hero', 'gallery'] as const).map((placement) => (
        <button
          key={placement}
          type="button"
          disabled={processing}
          onClick={() =>
            onImagePicked?.(placement, new File(['img'], 'ad.png', { type: 'image/png' }))
          }
        >
          {placement} 업로드
        </button>
      ))}
    </>
  ),
}));

function renderPage() {
  const queryClient = new QueryClient();
  return render(
    <ThemeProvider theme={theme}>
      <QueryClientProvider client={queryClient}>
        <BizAdsPage />
      </QueryClientProvider>
    </ThemeProvider>,
  );
}

async function openNameModal(placement: 'hero' | 'gallery') {
  fireEvent.click(screen.getByRole('button', { name: '광고 추가' }));
  fireEvent.click(screen.getByRole('button', { name: `${placement} 업로드` }));
  await screen.findByRole('dialog', { name: '광고명' });
  // 위치 select는 제거되고 링크 입력만 남는다.
  expect(screen.queryByLabelText('광고 위치')).toBeNull();
  fireEvent.change(screen.getByPlaceholderText('광고명을 입력해주세요'), {
    target: { value: '봄 이벤트' },
  });
}

function fillLink(value: string) {
  fireEvent.change(screen.getByLabelText('광고 링크'), { target: { value } });
}

async function submitReservation() {
  fireEvent.click(await screen.findByRole('button', { name: '계약 신청' }));
  await waitFor(() => expect(mocks.createAd).toHaveBeenCalled());
  expect(mocks.requestPayment).toHaveBeenCalledWith(
    expect.objectContaining({ orderId: 'order-1', amount: 100000, flow: 'ad' }),
  );
}

const heroBody = {
  productId: 'hero',
  startDate: expect.any(String),
  endDate: expect.any(String),
  expectedDailyPrice: 100000,
  title: '봄 이벤트',
  imageFileId: 'file-1',
};

describe('BizAdsPage 광고 링크 입력', () => {
  beforeEach(() => {
    mocks.ads = [];
    mocks.createAd.mockReset();
    mocks.updateAd.mockReset();
    mocks.routerPush.mockReset();
    mocks.createAd.mockResolvedValue({
      status: 201,
      data: { paidAmount: 100000, order: { id: 'order-1', amount: 100000, name: '봄 이벤트' } },
    });
    mocks.toastSuccess.mockReset();
    mocks.toastError.mockReset();
    mocks.fetchMock.mockReset();
    mocks.fetchMock.mockResolvedValue({ ok: true });
    mocks.requestPayment.mockReset();
    mocks.requestPayment.mockResolvedValue(true);
    mocks.cancelOrder.mockReset();
    mocks.cancelOrder.mockResolvedValue({});
    vi.stubGlobal('fetch', mocks.fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('링크가 비어 있거나 공백만 있으면 landingUrl 없이 계약 신청된다', async () => {
    renderPage();
    await openNameModal('hero');
    fillLink('   ');

    fireEvent.click(screen.getByRole('button', { name: '등록하기' }));
    await submitReservation();

    // 기존 계약 신청 body 계약(title/기간/금액/이미지)이 그대로 유지된다.
    expect(mocks.createAd.mock.calls[0][0].data).toEqual(heroBody);
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it('http(s)가 아닌 링크는 등록이 거부되고 계약 신청되지 않는다', async () => {
    renderPage();
    await openNameModal('hero');
    fillLink('javascript:alert(1)');

    fireEvent.click(screen.getByRole('button', { name: '등록하기' }));

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        '링크 주소를 확인해주세요',
        'http:// 또는 https://로 시작하는 주소만 등록할 수 있어요',
      ),
    );
    expect(mocks.createAd).not.toHaveBeenCalled();
  });

  it('유효한 링크는 앞뒤 공백을 제거해 landingUrl에 전달된다', async () => {
    renderPage();
    await openNameModal('hero');
    fillLink('  https://example.com/land?src=ad  ');

    fireEvent.click(screen.getByRole('button', { name: '등록하기' }));
    await submitReservation();

    expect(mocks.createAd.mock.calls[0][0].data).toEqual({
      ...heroBody,
      landingUrl: 'https://example.com/land?src=ad',
    });
  });

  it('대소문자가 섞인 HTTP 스킴은 홈 캐러셀 관례대로 허용된다', async () => {
    renderPage();
    await openNameModal('hero');
    fillLink('HTTP://Example.com/path');

    fireEvent.click(screen.getByRole('button', { name: '등록하기' }));
    await submitReservation();

    expect(mocks.toastError).not.toHaveBeenCalled();
    expect(mocks.createAd.mock.calls[0][0].data.landingUrl).toBe('HTTP://Example.com/path');
  });

  it('hero와 gallery의 링크는 서로 섞이지 않는다', async () => {
    renderPage();

    await openNameModal('hero');
    fillLink('https://example.com/hero');
    fireEvent.click(screen.getByRole('button', { name: '등록하기' }));
    await submitReservation();

    // 계약 완료 화면에서 광고 관리로 돌아와 두 번째 placement를 진행한다.
    fireEvent.click(screen.getByRole('button', { name: '광고 관리로 이동' }));
    await openNameModal('gallery');
    fillLink('https://example.com/gallery');
    fireEvent.click(screen.getByRole('button', { name: '등록하기' }));
    await submitReservation();

    expect(mocks.createAd).toHaveBeenCalledTimes(2);
    expect(mocks.createAd.mock.calls[0][0].data.productId).toBe('hero');
    expect(mocks.createAd.mock.calls[0][0].data.landingUrl).toBe('https://example.com/hero');
    expect(mocks.createAd.mock.calls[1][0].data.productId).toBe('gallery');
    expect(mocks.createAd.mock.calls[1][0].data.landingUrl).toBe('https://example.com/gallery');
  });

  it('같은 placement를 다시 업로드하면 이전에 등록한 링크가 채워져 있다', async () => {
    renderPage();

    await openNameModal('hero');
    fillLink('https://example.com/again');
    fireEvent.click(screen.getByRole('button', { name: '등록하기' }));

    // 결제 팝업을 닫고 광고 관리로 돌아와 같은 placement를 다시 업로드한다.
    fireEvent.click(await screen.findByRole('button', { name: '취소' }));
    fireEvent.click(screen.getByRole('button', { name: '광고 관리로 돌아가기' }));
    await openNameModal('hero');
    expect((screen.getByLabelText('광고 링크') as HTMLInputElement).value).toBe(
      'https://example.com/again',
    );
  });

  it('이전에 링크를 넣은 placement를 다시 업로드해 링크를 비우면 landingUrl이 전송되지 않는다', async () => {
    renderPage();

    await openNameModal('hero');
    fillLink('https://example.com/old');
    fireEvent.click(screen.getByRole('button', { name: '등록하기' }));
    fireEvent.click(await screen.findByRole('button', { name: '취소' }));
    fireEvent.click(screen.getByRole('button', { name: '광고 관리로 돌아가기' }));

    await openNameModal('hero');
    fillLink('');
    fireEvent.click(screen.getByRole('button', { name: '등록하기' }));
    await submitReservation();

    expect(mocks.createAd).toHaveBeenCalledTimes(1);
    expect(mocks.createAd.mock.calls[0][0].data.landingUrl).toBeUndefined();
  });
});

describe('BizAdsPage 현재 나의 광고 빈 상태', () => {
  beforeEach(() => {
    mocks.ads = [];
    mocks.createAd.mockReset();
    mocks.toastSuccess.mockReset();
    mocks.toastError.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('광고가 없으면 빈 상태 이미지와 안내 문구를 표시한다', () => {
    renderPage();

    const section = screen.getByRole('heading', { name: '현재 나의 광고' }).closest('section');
    expect(section).not.toBeNull();
    // 장식 이미지(alt="")는 role=img가 아니므로 alt로 직접 찾는다.
    const emptyImage = within(section as HTMLElement).getByAltText('');
    expect((emptyImage as HTMLImageElement).src).toContain('/assets/empty-contents.png');
    expect(screen.getByText('광고가 없어요')).not.toBeNull();
  });
});

describe('BizAdsPage 광고 관리 목록 작업 버튼', () => {
  beforeEach(() => {
    mocks.ads = [
      {
        id: 'ad-active',
        title: '진행중 광고',
        startDate: '2026-10-01',
        endDate: '2026-11-01',
        paidAmount: 100000,
        status: 'active',
        imageUrl: null,
      },
      {
        id: 'ad-paused',
        title: '중단 광고',
        startDate: '2026-10-01',
        endDate: '2026-11-01',
        paidAmount: 100000,
        status: 'paused',
        imageUrl: null,
      },
    ];
    mocks.routerPush.mockReset();
    mocks.updateAd.mockReset();
    mocks.updateAd.mockResolvedValue({ status: 200 });
    mocks.toastSuccess.mockReset();
  });

  afterEach(() => cleanup());

  it('리포트 버튼은 해당 광고의 기존 리포트 경로로 이동한다', () => {
    renderPage();

    fireEvent.click(screen.getAllByRole('button', { name: '리포트' })[0]);

    expect(mocks.routerPush).toHaveBeenCalledWith('/reports?adId=ad-active');
  });

  it('진행중 광고만 중단할 수 있고, 요청 중에는 처리 상태를 표시한다', async () => {
    let resolvePause: (() => void) | undefined;
    mocks.updateAd.mockImplementation(
      () => new Promise<void>((resolve) => (resolvePause = resolve)),
    );
    renderPage();

    const pauseButtons = screen.getAllByRole('button', { name: '중단' });
    expect((pauseButtons[0] as HTMLButtonElement).disabled).toBe(false);
    expect((pauseButtons[1] as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(pauseButtons[0]);
    expect((screen.getByRole('button', { name: '처리 중…' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(mocks.updateAd).toHaveBeenCalledWith({ id: 'ad-active', data: { status: 'paused' } });

    resolvePause?.();
    await waitFor(() => expect(mocks.toastSuccess).toHaveBeenCalledWith('광고를 중단했습니다.'));
  });
});
