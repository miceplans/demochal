import { beforeEach, describe, expect, it, vi } from 'vitest';

const imageCompression = vi.hoisted(() => vi.fn());
vi.mock('browser-image-compression', () => ({ default: imageCompression }));

import { compressToWebP, CROPPED_AD_IMAGE_PRESETS } from './image-compression';

describe('compressToWebP', () => {
  beforeEach(() => {
    imageCompression.mockReset();
    vi.stubGlobal('URL', { ...URL, createObjectURL: () => 'blob:preview' });
  });

  it('Web Worker 없이 압축한다 — 워커는 CDN 스크립트를 불러와 CSP에 막힌다', async () => {
    imageCompression.mockResolvedValue(new Blob(['x'], { type: 'image/webp' }));
    const file = new File(['abc'], 'ad.png', { type: 'image/png' });

    const result = await compressToWebP(file, CROPPED_AD_IMAGE_PRESETS.hero);

    expect(imageCompression).toHaveBeenCalledWith(
      file,
      expect.objectContaining({ fileType: 'image/webp', useWebWorker: false }),
    );
    expect(result.file.name).toBe('ad.webp');
    expect(result.file.type).toBe('image/webp');
  });

  it('이미지가 아닌 파일은 거부한다', async () => {
    const file = new File(['abc'], 'a.txt', { type: 'text/plain' });
    await expect(compressToWebP(file, CROPPED_AD_IMAGE_PRESETS.hero)).rejects.toThrow(
      '이미지 파일만',
    );
    expect(imageCompression).not.toHaveBeenCalled();
  });
});
