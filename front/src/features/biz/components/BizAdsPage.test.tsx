import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BizAdsPage } from './BizAdsPage';

const mocks = vi.hoisted(() => ({
  createAd: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  fetchMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

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
      data: { status: 200, data: [] },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    }),
    useUpdateAd: () => ({ mutateAsync: vi.fn() }),
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
    hero: { maxWidth: 1060, quality: 0.8 },
    gallery: { maxWidth: 315, quality: 0.8 },
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
    <QueryClientProvider client={queryClient}>
      <BizAdsPage />
    </QueryClientProvider>,
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
    mocks.createAd.mockReset();
    mocks.createAd.mockResolvedValue({ status: 201, data: { paidAmount: 100000 } });
    mocks.toastSuccess.mockReset();
    mocks.toastError.mockReset();
    mocks.fetchMock.mockReset();
    mocks.fetchMock.mockResolvedValue({ ok: true });
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
});
