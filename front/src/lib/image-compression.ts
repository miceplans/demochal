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

// 크롭 모달에서 이미 광고 크기(2x)로 잘라 WebP로 만든 파일용 — 재압축으로 화질이 또 깎이지 않게
// 해상도 상한을 크롭 출력(hero 2120 / gallery 596)보다 크게, 용량·품질 상한을 넉넉하게 둔다.
export const CROPPED_AD_IMAGE_PRESETS = {
  hero: { initialQuality: 0.95, maxSizeMB: 1, maxWidthOrHeight: 2400 },
  gallery: { initialQuality: 0.95, maxSizeMB: 0.5, maxWidthOrHeight: 1200 },
} as const satisfies Record<string, AdImagePreset>;

export const PROFILE_IMAGE_PRESET = {
  initialQuality: 0.85,
  maxSizeMB: 0.2,
  maxWidthOrHeight: 512,
} as const satisfies AdImagePreset;

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 ** 2) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)}MB`;
}

export async function compressToWebP(
  file: File,
  preset: AdImagePreset,
): Promise<CompressedAdImage> {
  if (!file.type.startsWith('image/')) {
    throw new Error('이미지 파일만 업로드할 수 있어요.');
  }
  const compressed = await imageCompression(file, {
    fileType: 'image/webp',
    useWebWorker: true,
    ...preset,
  });
  const webpFile = new File([compressed], `${file.name.replace(/\.[^.]+$/, '')}.webp`, {
    type: 'image/webp',
  });
  return {
    compressedSize: webpFile.size,
    file: webpFile,
    originalSize: file.size,
    previewUrl: URL.createObjectURL(webpFile),
  };
}
