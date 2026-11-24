import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@emotion/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { theme } from '@/styles/theme';
import { ToastProvider } from '@/components/common/Toast';
import { AdminAdCreateModal } from './AdminAdCreateModal';

const create = vi.fn();
const presign = vi.fn();
const finalize = vi.fn();

vi.mock('@semochal/api-client', () => ({
  generated: {
    useListAdminBusinesses: () => ({
      data: { data: { items: [{ id: 'biz-1', org: '세모 기관' }] } },
    }),
    useListAdProducts: () => ({
      data: { data: [{ id: 'hero', name: '홈 히어로 배너', placement: 'hero' }] },
    }),
    useRequestPresignedUpload: () => ({ mutateAsync: presign }),
    useFinalizeUpload: () => ({ mutateAsync: finalize }),
    useCreateAdminAd: () => ({ isPending: false, mutate: create }),
  },
}));

vi.mock('@/lib/image-compression', () => ({
  CROPPED_AD_IMAGE_PRESETS: { hero: {}, gallery: {} },
  compressToWebP: vi.fn(async (file: File) => ({
    file: new File([file], 'ad.webp', { type: 'image/webp' }),
    previewUrl: 'blob:preview',
    originalSize: 1,
    compressedSize: 1,
  })),
}));

describe('AdminAdCreateModal', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('결제 단계 없이 업로드한 이미지로 관리자 광고 생성을 요청한다', async () => {
    presign.mockResolvedValue({ data: { uploadUrl: 'https://s3.example/put', fileId: 'file-1' } });
    finalize.mockResolvedValue({});
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    vi.stubGlobal('URL', Object.assign(URL, { revokeObjectURL: vi.fn() }));

    render(
      <ThemeProvider theme={theme}>
        <ToastProvider>
          <AdminAdCreateModal onClose={vi.fn()} onCreated={vi.fn()} />
        </ToastProvider>
      </ThemeProvider>,
    );

    const submit = screen.getByRole('button', { name: '추가' }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    const pick = (label: string, option: string) => {
      fireEvent.click(screen.getByRole('combobox', { name: label }));
      fireEvent.click(screen.getByRole('option', { name: option }));
    };
    pick('기관', '세모 기관');
    pick('위치', '홈 히어로 배너');
    fireEvent.change(screen.getByLabelText('광고명'), { target: { value: ' 운영 광고 ' } });
    fireEvent.change(screen.getByLabelText('광고 이미지'), {
      target: { files: [new File(['x'], 'ad.png', { type: 'image/png' })] },
    });
    await waitFor(() => expect(screen.getByText('ad.png 업로드 완료')).toBeTruthy());

    fireEvent.click(submit);
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        businessId: 'biz-1',
        productId: 'hero',
        title: '운영 광고',
        imageFileId: 'file-1',
      }),
    });
  });
});
