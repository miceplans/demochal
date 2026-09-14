import imageCompression from 'browser-image-compression';

export type AdImagePreset = {
  initialQuality: number;
  maxSizeMB: number;
  maxWidthOrHeight: number;
};

export type CompressedAdImage = {
  compressedSize: number;
  file: File;
  originalSize: number;
  previewUrl: string;
};

export const AD_IMAGE_PRESETS = {
  hero: { initialQuality: 0.8, maxSizeMB: 0.3, maxWidthOrHeight: 1920 },
  gallery: { initialQuality: 0.8, maxSizeMB: 0.15, maxWidthOrHeight: 900 },
} as const satisfies Record<string, AdImagePreset>;

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 ** 2) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)}MB`;
}

export async function compressToWebP(file: File, preset: AdImagePreset): Promise<CompressedAdImage> {
  if (!file.type.startsWith('image/')) {
    throw new Error('이미지 파일만 업로드할 수 있어요.');
  }
  const compressed = await imageCompression(file, {
    fileType: 'image/webp',
    useWebWorker: true,
    ...preset,
  });
  const webpFile = new File([compressed], `${file.name.replace(/\.[^.]+$/, '')}.webp`, { type: 'image/webp' });
  return {
    compressedSize: webpFile.size,
    file: webpFile,
    originalSize: file.size,
    previewUrl: URL.createObjectURL(webpFile),
  };
}
