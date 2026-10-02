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
    useListAdProducts: () => ({
      data: {
        status: 200,
        data: [
          {
            id: 'hero',
            name: '홈 히어로 배너',
            placement: 'hero',
            dailyPrice: 100000,
            reservedPeriods: [],
          },
        ],
      },
    }),
    listAdProducts: vi.fn(async () => ({
      data: [
        {
          id: 'hero',
          name: '홈 히어로 배너',
          placement: 'hero',
          dailyPrice: 100000,
          reservedPeriods: [],
        },
      ],
    })),
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

vi.mock('@/lib/api-error', () => ({ apiErrorMessage: (_: unknown, fallback: string) => fallback }));

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
    <button
      type="button"
      disabled={processing}
      onClick={() => onImagePicked?.('hero', new File(['img'], 'ad.png', { type: 'image/png' }))}
    >
      이미지 업로드 흉내
    </button>
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

async function openNameModal() {
  fireEvent.click(screen.getByRole('button', { name: '광고 추가' }));
  fireEvent.click(screen.getByRole('button', { name: '이미지 업로드 흉내' }));
  await screen.findByRole('dialog', { name: '광고명' });
  fireEvent.change(screen.getByPlaceholderText('광고명을 입력해주세요'), {
    target: { value: '봄 이벤트' },
  });
}

async function submitReservation() {
  fireEvent.click(await screen.findByRole('button', { name: '계약 신청' }));
  await waitFor(() => expect(mocks.createAd).toHaveBeenCalledTimes(1));
}

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

  it('링크를 입력하지 않으면 landingUrl 없이 계약 신청된다', async () => {
    renderPage();
    await openNameModal();

    fireEvent.click(screen.getByRole('button', { name: '등록하기' }));
    await submitReservation();

    expect(mocks.createAd.mock.calls[0][0].data.landingUrl).toBeUndefined();
  });

  it('http(s)가 아닌 링크는 등록이 거부되고 계약 신청되지 않는다', async () => {
    renderPage();
    await openNameModal();

    fireEvent.change(screen.getByPlaceholderText('https:// 광고 클릭 시 이동할 링크 (선택)'), {
      target: { value: 'javascript:alert(1)' },
    });
    fireEvent.click(screen.getByRole('button', { name: '등록하기' }));

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        '링크 주소를 확인해주세요',
        'http:// 또는 https://로 시작하는 주소만 등록할 수 있어요',
      ),
    );
    expect(mocks.createAd).not.toHaveBeenCalled();
  });

  it('유효한 링크는 계약 신청의 landingUrl에 그대로 전달된다', async () => {
    renderPage();
    await openNameModal();

    fireEvent.change(screen.getByPlaceholderText('https:// 광고 클릭 시 이동할 링크 (선택)'), {
      target: { value: 'https://example.com/land?src=ad' },
    });
    fireEvent.click(screen.getByRole('button', { name: '등록하기' }));
    await submitReservation();

    expect(mocks.createAd.mock.calls[0][0].data.landingUrl).toBe('https://example.com/land?src=ad');
  });
});
