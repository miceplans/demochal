import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PresignedUploadError, putToPresignedUrl, useFileUpload } from './upload';

const mocks = vi.hoisted(() => ({
  presign: vi.fn(),
  finalize: vi.fn(),
  fetch: vi.fn(),
  hookOptions: [] as unknown[],
}));

vi.mock('@semochal/api-client', () => ({
  generated: {
    useRequestPresignedUpload: (options?: unknown) => {
      mocks.hookOptions.push(options);
      return { mutateAsync: mocks.presign };
    },
    useFinalizeUpload: (options?: unknown) => {
      mocks.hookOptions.push(options);
      return { mutateAsync: mocks.finalize };
    },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.hookOptions = [];
  vi.stubGlobal('fetch', mocks.fetch);
  mocks.fetch.mockResolvedValue({ ok: true, status: 200 });
  mocks.presign.mockResolvedValue({
    status: 201,
    data: { uploadUrl: 'https://s3.example/put', fileId: 'file-1' },
  });
  mocks.finalize.mockResolvedValue({
    status: 201,
    data: { id: 'file-1', url: 'https://cdn.example/a.webp' },
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('putToPresignedUrl', () => {
  it('Content-Type을 붙여 presigned URL로 PUT한다', async () => {
    const file = new File(['x'], 'a.png', { type: 'image/png' });
    await putToPresignedUrl('https://s3.example/put', file, 'image/png');
    expect(mocks.fetch).toHaveBeenCalledWith('https://s3.example/put', {
      method: 'PUT',
      headers: { 'Content-Type': 'image/png' },
      body: file,
    });
  });

  it('S3가 실패 응답을 주면 PresignedUploadError를 던진다', async () => {
    mocks.fetch.mockResolvedValue({ ok: false, status: 403 });
    await expect(
      putToPresignedUrl('https://s3.example/put', new Blob(['x']), 'image/png'),
    ).rejects.toBeInstanceOf(PresignedUploadError);
  });
});

describe('useFileUpload', () => {
  it('presign → PUT → finalize 순서로 올리고 fileId·url을 돌려준다', async () => {
    const { result } = renderHook(() => useFileUpload());
    const file = new File(['x'], 'dir/a.webp', { type: 'image/webp' });

    const uploaded = await result.current(file, { bucket: 'public' });

    expect(mocks.presign).toHaveBeenCalledWith({
      data: { bucket: 'public', contentType: 'image/webp', fileName: 'dir_a.webp', sizeBytes: 1 },
    });
    expect(mocks.fetch).toHaveBeenCalledWith(
      'https://s3.example/put',
      expect.objectContaining({ method: 'PUT' }),
    );
    expect(mocks.finalize).toHaveBeenCalledWith({ id: 'file-1' });
    expect(uploaded).toEqual({ fileId: 'file-1', url: 'https://cdn.example/a.webp' });
  });

  it('S3 업로드가 실패하면 finalize하지 않는다', async () => {
    mocks.fetch.mockResolvedValue({ ok: false, status: 500 });
    const { result } = renderHook(() => useFileUpload());

    await expect(
      result.current(new File(['x'], 'a.pdf', { type: 'application/pdf' }), {
        bucket: 'private',
      }),
    ).rejects.toBeInstanceOf(PresignedUploadError);
    expect(mocks.finalize).not.toHaveBeenCalled();
  });

  it('localErrors면 mutation onError를 달아 전역 토스트를 끈다', () => {
    renderHook(() => useFileUpload({ localErrors: true }));
    expect(mocks.hookOptions).toEqual([
      { mutation: { onError: expect.any(Function) } },
      { mutation: { onError: expect.any(Function) } },
    ]);
  });
});
