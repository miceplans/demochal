import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@emotion/react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BizAdsPage } from './BizAdsPage';
import { theme } from '@/styles/theme';
import { toDateKey } from '@/lib/date';

type TestAd = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  paidAmount: number;
  productId?: string;
  status: 'active' | 'paused' | 'preparing';
  imageUrl: string | null;
};

const mocks = vi.hoisted(() => ({
  ads: [] as TestAd[],
  createAd: vi.fn(),
  updateAd: vi.fn(),
  updateContent: vi.fn(),
  deleteAd: vi.fn(),
  routerPush: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  fetchMock: vi.fn(),
  requestPayment: vi.fn(),
  cancelOrder: vi.fn(),
  listAdProducts: vi.fn(),
  compressToWebP: vi.fn(),
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
    useDeleteAd: () => ({ mutateAsync: mocks.deleteAd }),
    useCreateAd: () => ({ mutateAsync: mocks.createAd }),
    useUpdateAdContent: () => ({ mutateAsync: mocks.updateContent }),
    useRequestPresignedUpload: () => ({
      mutateAsync: vi.fn(async () => ({
        data: { uploadUrl: 'https://upload.example', fileId: 'file-1' },
      })),
    }),
    useFinalizeUpload: () => ({ mutateAsync: vi.fn(async () => undefined) }),
    useListMyNotifications: () => ({ data: { data: [] } }),
    useListAdProducts: () => ({ data: { status: 200, data: products } }),
    listAdProducts: mocks.listAdProducts,
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
  compressToWebP: mocks.compressToWebP,
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
    onSelect,
    onImagePicked,
    processing,
    uploadedImages,
  }: {
    onSelect?: (placement: 'hero' | 'gallery') => void;
    onImagePicked?: (placement: 'hero' | 'gallery', file: File) => void;
    processing?: boolean;
    uploadedImages?: Partial<Record<'hero' | 'gallery', string>>;
  }) => (
    <>
      {(['hero', 'gallery'] as const).map((placement) => (
        <span key={placement}>
          {uploadedImages?.[placement] ? (
            <span data-testid={`${placement}-uploaded-image`}>업로드된 이미지</span>
          ) : null}
          <button type="button" onClick={() => onSelect?.(placement)}>
            {placement} 선택
          </button>
          <button
            type="button"
            disabled={processing}
            onClick={() =>
              onImagePicked?.(placement, new File(['img'], 'ad.png', { type: 'image/png' }))
            }
          >
            {placement} 업로드
          </button>
        </span>
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

const PAID_NO_IMAGE: TestAd = {
  id: 'ad-paid',
  productId: 'hero',
  title: '홈 히어로 배너',
  startDate: '2099-01-01T00:00:00.000Z',
  endDate: '2099-01-10T00:00:00.000Z',
  paidAmount: 1000000,
  status: 'active',
  imageUrl: null,
};

// 결제 완료 후 내용 등록: 관리 목록의 "이미지 등록" → 업로드 → 광고명 모달까지 연다.
async function openNameModalForPaidAd(link?: string) {
  fireEvent.click(await screen.findByRole('button', { name: '이미지 등록' }));
  fireEvent.click(screen.getByRole('button', { name: 'hero 업로드' }));
  await screen.findByRole('dialog', { name: '광고명' });
  fireEvent.change(screen.getByPlaceholderText('광고명을 입력해주세요'), {
    target: { value: '봄 이벤트' },
  });
  if (link !== undefined)
    fireEvent.change(screen.getByLabelText('광고 링크'), { target: { value: link } });
}

async function startPayment(placement: 'hero' | 'gallery' = 'hero') {
  fireEvent.click(screen.getByRole('button', { name: '광고 추가' }));
  fireEvent.click(screen.getByRole('button', { name: `${placement} 선택` }));
  fireEvent.click(await screen.findByRole('button', { name: '계약 신청' }));
  await waitFor(() => expect(mocks.createAd).toHaveBeenCalled());
}

function resetMocks() {
  mocks.ads = [];
  mocks.createAd.mockReset();
  mocks.updateAd.mockReset();
  mocks.updateContent.mockReset();
  mocks.routerPush.mockReset();
  mocks.createAd.mockResolvedValue({
    status: 201,
    data: { paidAmount: 100000, order: { id: 'order-1', amount: 100000, name: '홈 히어로 배너' } },
  });
  mocks.updateContent.mockResolvedValue({});
  mocks.toastSuccess.mockReset();
  mocks.toastError.mockReset();
  mocks.fetchMock.mockReset();
  mocks.fetchMock.mockResolvedValue({ ok: true });
  mocks.requestPayment.mockReset();
  mocks.requestPayment.mockResolvedValue(true);
  mocks.cancelOrder.mockReset();
  mocks.cancelOrder.mockResolvedValue({});
  mocks.listAdProducts.mockReset();
  mocks.listAdProducts.mockResolvedValue({ data: products });
  mocks.compressToWebP.mockReset();
  mocks.compressToWebP.mockResolvedValue({
    file: new File(['webp'], 'ad.webp', { type: 'image/webp' }),
    previewUrl: 'blob:preview',
    originalSize: 1000,
    compressedSize: 500,
  });
  vi.stubGlobal('fetch', mocks.fetchMock);
}

describe('BizAdsPage 결제 단계 (결제 → 이미지 업로드 → 광고명)', () => {
  beforeEach(resetMocks);
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('상품을 선택하면 이미지·광고명 없이 결제부터 진행한다', async () => {
    renderPage();
    await startPayment('hero');

    const body = mocks.createAd.mock.calls[0][0].data;
    expect(body).toEqual({
      productId: 'hero',
      startDate: expect.any(String),
      endDate: expect.any(String),
      expectedDailyPrice: 100000,
    });
    expect(mocks.requestPayment).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 'order-1', amount: 100000, flow: 'ad' }),
    );
  });

  it('결제창을 연 직후에는 결제가 확정되지 않았으므로 완료 화면으로 넘어가지 않는다', async () => {
    renderPage();
    await startPayment();

    await waitFor(() =>
      expect(
        (screen.getByRole('button', { name: '계약 신청' }) as HTMLButtonElement).disabled,
      ).toBe(false),
    );
    expect(screen.queryByText('광고 계약 신청이 완료되었습니다')).toBeNull();
    expect(mocks.updateContent).not.toHaveBeenCalled();
  });

  it('결제창을 열 수 없으면 주문을 취소하고 오류를 표시한다', async () => {
    mocks.requestPayment.mockResolvedValue(false);
    renderPage();
    await startPayment();

    await waitFor(() => expect(mocks.cancelOrder).toHaveBeenCalledWith('order-1'));
    expect(mocks.toastError).toHaveBeenCalled();
  });

  it('Toss SDK가 결제창 진입 중 예외를 던져도 예약 주문을 취소한다', async () => {
    mocks.requestPayment.mockRejectedValue(new Error('결제창이 차단되었습니다'));
    renderPage();
    await startPayment();

    await waitFor(() => expect(mocks.cancelOrder).toHaveBeenCalledWith('order-1'));
    expect(mocks.toastError).toHaveBeenCalled();
  });

  it('결제 모달에서 상품 설명 페이지 링크를 제공한다', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: '광고 추가' }));
    fireEvent.click(screen.getByRole('button', { name: 'hero 선택' }));

    const link = await screen.findByRole('link', { name: /상품 설명/ });
    expect(link.getAttribute('href')).toBe('/advertising/products');
  });

  it('결제 모달에서 환불 정책 페이지 링크를 제공한다', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: '광고 추가' }));
    fireEvent.click(screen.getByRole('button', { name: 'hero 선택' }));

    const refundLink = await screen.findByRole('link', { name: '환불 정책 >' });
    expect(refundLink.getAttribute('href')).toBe('/refund-policy');
  });

  it('선택한 광고 기간이 늘어나면 표시 금액과 신청 기간이 함께 늘어난다', async () => {
    const start = new Date();
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: '광고 추가' }));
    fireEvent.click(screen.getByRole('button', { name: 'hero 선택' }));

    expect(await screen.findByText('100,000원')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '광고 기간 선택' }));
    const endLabel = new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric' }).format(
      end,
    );
    const dayButton = (label: string) =>
      screen
        .getAllByRole('button')
        .find((button) => button.getAttribute('aria-label')?.includes(label)) as HTMLElement;
    fireEvent.click(dayButton(endLabel));

    expect(await screen.findByText('200,000원')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '계약 신청' }));
    await waitFor(() => expect(mocks.createAd).toHaveBeenCalled());
    expect(mocks.createAd.mock.calls[0][0].data).toEqual(
      expect.objectContaining({ startDate: toDateKey(start), endDate: toDateKey(end) }),
    );
  });

  it('결제 전에는 이미지를 업로드할 수 없다', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: '광고 추가' }));
    fireEvent.click(screen.getByRole('button', { name: 'hero 업로드' }));

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        '결제를 완료한 광고만 이미지를 등록할 수 있습니다.',
      ),
    );
    expect(screen.queryByRole('dialog', { name: '광고명' })).toBeNull();
  });

  it('새 등록을 시작한 뒤 늦게 완료된 상품 조회가 결제 모달을 다시 열지 않는다', async () => {
    let resolveProducts: ((value: { data: typeof products }) => void) | undefined;
    mocks.listAdProducts.mockImplementationOnce(
      () => new Promise<{ data: typeof products }>((resolve) => (resolveProducts = resolve)),
    );
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: '광고 추가' }));
    fireEvent.click(screen.getByRole('button', { name: 'hero 선택' }));
    fireEvent.click(screen.getByRole('button', { name: '광고 관리로 돌아가기' }));
    fireEvent.click(screen.getByRole('button', { name: '광고 추가' }));

    resolveProducts?.({ data: products });
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: '광고 계약 신청' })).toBeNull(),
    );
  });

  it('새 등록을 시작한 뒤 늦게 완료된 이미지 업로드가 이전 상태를 되살리지 않는다', async () => {
    mocks.ads = [PAID_NO_IMAGE];
    let resolveCompression:
      | ((value: {
          file: File;
          previewUrl: string;
          originalSize: number;
          compressedSize: number;
        }) => void)
      | undefined;
    mocks.compressToWebP.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveCompression = resolve;
        }),
    );
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: '이미지 등록' }));
    fireEvent.click(screen.getByRole('button', { name: 'hero 업로드' }));
    fireEvent.click(screen.getByRole('button', { name: '광고 관리로 돌아가기' }));
    fireEvent.click(screen.getByRole('button', { name: '광고 추가' }));

    resolveCompression?.({
      file: new File(['webp'], 'ad.webp', { type: 'image/webp' }),
      previewUrl: 'blob:late-preview',
      originalSize: 1000,
      compressedSize: 500,
    });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '광고명' })).toBeNull());
    expect(screen.queryByTestId('hero-uploaded-image')).toBeNull();
  });
});

describe('BizAdsPage 결제 완료 후 이미지·광고명 등록', () => {
  beforeEach(() => {
    resetMocks();
    mocks.ads = [PAID_NO_IMAGE];
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('결제는 됐지만 이미지가 없는 광고는 등록 필요로 표시된다', () => {
    renderPage();
    expect(screen.getByText('이미지 등록 필요')).toBeTruthy();
  });

  it('hero·gallery 밖 상품의 이미지 없는 광고에는 등록 버튼을 표시하지 않는다', () => {
    mocks.ads = [{ ...PAID_NO_IMAGE, id: 'ad-team', productId: 'team' }];
    renderPage();

    expect(screen.queryByRole('button', { name: '이미지 등록' })).toBeNull();
    expect(screen.queryByText('이미지 등록 필요')).toBeNull();
  });

  it('이미지를 올리고 광고명을 입력하면 해당 광고에 내용이 등록된다', async () => {
    renderPage();
    await openNameModalForPaidAd('https://example.com/hero');

    fireEvent.click(screen.getByRole('button', { name: '등록하기' }));

    await waitFor(() => expect(mocks.updateContent).toHaveBeenCalledTimes(1));
    expect(mocks.updateContent).toHaveBeenCalledWith({
      id: 'ad-paid',
      data: {
        imageFileId: 'file-1',
        title: '봄 이벤트',
        landingUrl: 'https://example.com/hero',
      },
    });
    expect(mocks.createAd).not.toHaveBeenCalled();
    expect(mocks.requestPayment).not.toHaveBeenCalled();
  });

  it('링크가 비어 있거나 공백만 있으면 landingUrl 없이 등록된다', async () => {
    renderPage();
    await openNameModalForPaidAd('   ');

    fireEvent.click(screen.getByRole('button', { name: '등록하기' }));

    await waitFor(() => expect(mocks.updateContent).toHaveBeenCalled());
    expect(mocks.updateContent.mock.calls[0][0].data.landingUrl).toBeUndefined();
  });

  it('http(s)가 아닌 링크는 거부되고 등록되지 않는다', async () => {
    renderPage();
    await openNameModalForPaidAd('javascript:alert(1)');

    fireEvent.click(screen.getByRole('button', { name: '등록하기' }));

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalled());
    expect(mocks.updateContent).not.toHaveBeenCalled();
  });

  it('유효한 링크는 앞뒤 공백을 제거하고, 대소문자가 섞인 HTTP 스킴도 허용한다', async () => {
    renderPage();
    await openNameModalForPaidAd('  HTTPS://Example.com/path  ');

    fireEvent.click(screen.getByRole('button', { name: '등록하기' }));

    await waitFor(() => expect(mocks.updateContent).toHaveBeenCalled());
    expect(mocks.updateContent.mock.calls[0][0].data.landingUrl).toBe('HTTPS://Example.com/path');
  });

  it('등록에 실패하면 오류를 표시하고 목록으로 돌아가지 않는다', async () => {
    mocks.updateContent.mockRejectedValue(new Error('결제가 완료된 광고만'));
    renderPage();
    await openNameModalForPaidAd();

    fireEvent.click(screen.getByRole('button', { name: '등록하기' }));

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalled());
    expect(mocks.toastSuccess).not.toHaveBeenCalledWith('광고가 등록되었습니다.');
  });

  it('광고 추가를 다시 시작하면 이전 업로드 상태를 초기화한다', async () => {
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    renderPage();
    await openNameModalForPaidAd();

    fireEvent.change(screen.getByPlaceholderText('광고명을 입력해주세요'), {
      target: { value: '이전 광고명' },
    });
    fireEvent.change(screen.getByLabelText('광고 링크'), {
      target: { value: 'https://previous.example' },
    });
    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    fireEvent.click(screen.getByRole('button', { name: '광고 관리로 돌아가기' }));

    fireEvent.click(screen.getByRole('button', { name: '광고 추가' }));

    expect(screen.queryByTestId('hero-uploaded-image')).toBeNull();
    expect(screen.queryByRole('dialog', { name: '광고명' })).toBeNull();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:preview');

    fireEvent.click(screen.getByRole('button', { name: '광고 관리로 돌아가기' }));
    fireEvent.click(screen.getByRole('button', { name: '이미지 등록' }));
    fireEvent.click(screen.getByRole('button', { name: 'hero 업로드' }));
    const nameDialog = await screen.findByRole('dialog', { name: '광고명' });
    expect((within(nameDialog).getByLabelText('광고명') as HTMLInputElement).value).toBe('');
    expect((within(nameDialog).getByLabelText('광고 링크') as HTMLInputElement).value).toBe('');
    revokeObjectURL.mockRestore();
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
        imageUrl: 'https://cdn.example.com/ad.webp',
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
    mocks.deleteAd.mockReset();
    mocks.deleteAd.mockResolvedValue({ status: 200 });
    mocks.toastSuccess.mockReset();
  });

  afterEach(() => cleanup());

  it('결제 대기 광고만 삭제할 수 있다', async () => {
    mocks.ads.push({
      id: 'ad-pending',
      title: '대기 광고',
      startDate: '2026-10-01',
      endDate: '2026-11-01',
      paidAmount: 100000,
      status: 'preparing',
      imageUrl: null,
    });
    renderPage();

    const deleteButtons = screen.getAllByRole('button', { name: '삭제' });
    expect(deleteButtons).toHaveLength(1);
    fireEvent.click(deleteButtons[0]);

    expect(mocks.deleteAd).toHaveBeenCalledWith({ id: 'ad-pending' });
    await waitFor(() =>
      expect(mocks.toastSuccess).toHaveBeenCalledWith('결제 대기 광고를 삭제했습니다.'),
    );
  });

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

  it('이미지를 아직 등록하지 않은 광고는 중단할 수 없다(등록 진입점 유지)', () => {
    mocks.ads = [{ ...PAID_NO_IMAGE, id: 'ad-no-image' }];
    renderPage();

    expect((screen.getByRole('button', { name: '중단' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('이미지 등록 필요')).toBeTruthy();
  });
});
