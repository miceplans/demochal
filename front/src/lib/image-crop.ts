// AdImageUploader(광고)와 공고 포스터 썸네일이 공용으로 쓰는 클라이언트 크롭 유틸.

const MAX_OUTPUT_EDGE = 2000;

export type CropImage = { file: File; url: string; width: number; height: number };

export function cropErrorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : '이미지를 처리할 수 없어요.';
}

export function readImage(file: File): Promise<CropImage> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('이미지 파일만 업로드할 수 있어요.'));
      return;
    }
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () =>
      image.naturalWidth && image.naturalHeight
        ? resolve({ file, url, width: image.naturalWidth, height: image.naturalHeight })
        : (URL.revokeObjectURL(url), reject(new Error('이미지를 읽을 수 없어요.')));
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('이미지를 읽을 수 없어요.'));
    };
    image.src = url;
  });
}

// position은 프레임 내 보여질 위치(0~1, 0.5가 중앙)다. 출력은 WebP로 minOutputWidth 이상의
// 너비를 유지한다 — 작은 원본도 노출 폭의 2배까지 키워 브라우저 확대 흐림을 피한다.
export async function makeCroppedFile(
  image: CropImage,
  aspectRatio: number,
  position: { x: number; y: number },
  minOutputWidth: number,
): Promise<File> {
  const sourceRatio = image.width / image.height;
  const cropWidth = sourceRatio > aspectRatio ? image.height * aspectRatio : image.width;
  const cropHeight = sourceRatio > aspectRatio ? image.height : image.width / aspectRatio;
  const canvas = document.createElement('canvas');
  // 대형 원본은 캔버스 면적 제한·업로드 용량(10MB) 초과를 막기 위해 긴 변 상한까지만 다운스케일한다.
  const scale = Math.min(
    Math.max(1, minOutputWidth / cropWidth),
    MAX_OUTPUT_EDGE / Math.max(cropWidth, cropHeight),
  );
  canvas.width = Math.max(1, Math.round(cropWidth * scale));
  canvas.height = Math.max(1, Math.round(cropHeight * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('이미지를 처리할 수 없어요.');
  const source = new Image();
  source.src = image.url;
  await new Promise<void>((resolve, reject) => {
    source.onload = () => resolve();
    source.onerror = reject;
  });
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(
    source,
    (image.width - cropWidth) * position.x,
    (image.height - cropHeight) * position.y,
    cropWidth,
    cropHeight,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (value) => (value ? resolve(value) : reject(new Error('이미지를 처리할 수 없어요.'))),
      'image/webp',
      0.98,
    ),
  );
  return new File([blob], `${image.file.name.replace(/\.[^.]+$/, '')}.webp`, {
    type: 'image/webp',
  });
}
