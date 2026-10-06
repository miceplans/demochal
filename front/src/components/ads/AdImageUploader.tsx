'use client';

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type PointerEvent,
} from 'react';
import { createPortal } from 'react-dom';
import styled from '@emotion/styled';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';

type Props = {
  busy?: boolean;
  compact?: boolean;
  label?: string;
  aspectRatio?: number;
  onFileSelected: (file: File) => void;
};
type CropImage = { file: File; url: string; width: number; height: number };

function readImage(file: File): Promise<CropImage> {
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

async function makeCroppedFile(
  image: CropImage,
  aspectRatio: number,
  position: { x: number; y: number },
): Promise<File> {
  const sourceRatio = image.width / image.height;
  const cropWidth = sourceRatio > aspectRatio ? image.height * aspectRatio : image.width;
  const cropHeight = sourceRatio > aspectRatio ? image.height : image.width / aspectRatio;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(cropWidth));
  canvas.height = Math.max(1, Math.round(cropHeight));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('이미지를 처리할 수 없어요.');
  const source = new Image();
  source.src = image.url;
  await new Promise<void>((resolve, reject) => {
    source.onload = () => resolve();
    source.onerror = reject;
  });
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
      0.92,
    ),
  );
  return new File([blob], `${image.file.name.replace(/\.[^.]+$/, '')}.webp`, {
    type: 'image/webp',
  });
}

export function AdImageUploader({
  busy = false,
  compact = false,
  label = '파일 찾기',
  aspectRatio = 1,
  onFileSelected,
}: Props) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [image, setImage] = useState<CropImage | null>(null);
  const [position, setPosition] = useState({ x: 0.5, y: 0.5 });
  const [processing, setProcessing] = useState(false);
  const dragRef = useRef<{ pointerX: number; pointerY: number; x: number; y: number } | null>(null);

  useEffect(
    () => () => {
      if (image) URL.revokeObjectURL(image.url);
    },
    [image],
  );
  const closeCrop = useCallback(() => {
    if (!processing) {
      setImage(null);
      setPosition({ x: 0.5, y: 0.5 });
    }
  }, [processing]);
  useEffect(() => {
    if (!image) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeCrop();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [closeCrop, image]);
  const chooseFile = async (file: File) => {
    if (busy || processing) return;
    try {
      setImage(await readImage(file));
      setPosition({ x: 0.5, y: 0.5 });
    } catch {
      setImage(null);
    }
  };
  const acceptFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (file) void chooseFile(file);
    if (inputRef.current) inputRef.current.value = '';
  };
  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDragOver(false);
    if (!busy) acceptFiles(event.dataTransfer.files);
  };
  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!image || processing) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerX: event.clientX, pointerY: event.clientY, ...position };
  };
  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || !image) return;
    const sourceRatio = image.width / image.height;
    const cropWidth = sourceRatio > aspectRatio ? image.height * aspectRatio : image.width;
    const cropHeight = sourceRatio > aspectRatio ? image.height : image.width / aspectRatio;
    setPosition({
      x: Math.min(
        1,
        Math.max(
          0,
          drag.x - (event.clientX - drag.pointerX) / Math.max(1, image.width - cropWidth) / 2,
        ),
      ),
      y: Math.min(
        1,
        Math.max(
          0,
          drag.y - (event.clientY - drag.pointerY) / Math.max(1, image.height - cropHeight) / 2,
        ),
      ),
    });
  };
  const confirmCrop = async () => {
    if (!image || processing) return;
    setProcessing(true);
    try {
      const file = await makeCroppedFile(image, aspectRatio, position);
      URL.revokeObjectURL(image.url);
      setImage(null);
      onFileSelected(file);
    } catch {
      setImage(null);
    } finally {
      setProcessing(false);
    }
  };
  const sourceRatio = image ? image.width / image.height : 1;
  const coverWidth = sourceRatio > aspectRatio ? `${(sourceRatio / aspectRatio) * 100}%` : '100%';
  const coverHeight = sourceRatio > aspectRatio ? '100%' : `${(aspectRatio / sourceRatio) * 100}%`;
  const imageLeft =
    sourceRatio > aspectRatio ? `${position.x * (100 - (100 * aspectRatio) / sourceRatio)}%` : '0%';
  const imageTop =
    sourceRatio > aspectRatio ? '0%' : `${position.y * (100 - (100 * sourceRatio) / aspectRatio)}%`;

  return (
    <>
      <DropZone
        htmlFor={inputId}
        compact={compact}
        dragOver={dragOver}
        onDragOver={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <UploadIcon src="/assets/icons/figma-upload-cloud.svg" alt="" compact={compact} />
        <Guide role={busy ? 'status' : undefined}>{busy ? '이미지 처리 중...' : label}</Guide>
        <HiddenInput
          id={inputId}
          ref={inputRef}
          type="file"
          accept="image/*"
          disabled={busy || processing}
          onChange={(event: ChangeEvent<HTMLInputElement>) => acceptFiles(event.target.files)}
        />
      </DropZone>
      {image && typeof document !== 'undefined'
        ? createPortal(
            <ModalBackdrop
              role="presentation"
              onMouseDown={(event) => event.currentTarget === event.target && closeCrop()}
            >
              <CropDialog role="dialog" aria-modal="true" aria-labelledby="ad-crop-title">
                <h2 id="ad-crop-title">광고 이미지 위치 조정</h2>
                <p>드래그해서 광고에 보일 위치를 조정한 뒤 확인해주세요.</p>
                <CropFrame
                  aspectRatio={aspectRatio}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={() => {
                    dragRef.current = null;
                  }}
                >
                  <CropImagePreview
                    src={image.url}
                    alt="광고 이미지 자르기 미리보기"
                    style={{
                      width: coverWidth,
                      height: coverHeight,
                      left: imageLeft,
                      top: imageTop,
                    }}
                  />
                </CropFrame>
                <CropActions>
                  <CropButton type="button" onClick={closeCrop} disabled={processing}>
                    취소
                  </CropButton>
                  <CropButton
                    type="button"
                    primary
                    onClick={() => void confirmCrop()}
                    disabled={processing}
                  >
                    {processing ? '처리 중...' : '확인'}
                  </CropButton>
                </CropActions>
              </CropDialog>
            </ModalBackdrop>,
            document.body,
          )
        : null}
    </>
  );
}

const DropZone = styled('label', {
  shouldForwardProp: (prop) => prop !== 'compact' && prop !== 'dragOver',
})<{ compact: boolean; dragOver: boolean }>(({ compact, dragOver }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: compact ? 6 : 10,
  width: '100%',
  height: '100%',
  minHeight: 0,
  padding: 8,
  borderRadius: 11,
  background: dragOver ? c.paleBlue : c.surface,
  cursor: 'pointer',
  textAlign: 'center',
  transition: 'background 120ms ease',
  '&:hover': { background: '#eaf3ff' },
}));
const UploadIcon = styled('img', { shouldForwardProp: (prop) => prop !== 'compact' })<{
  compact: boolean;
}>(({ compact }) => ({
  width: compact ? 40 : 58,
  height: 'auto',
  objectFit: 'contain',
  pointerEvents: 'none',
}));
const Guide = styled.span({ color: c.gray500, ...textStyle.metaText });
const HiddenInput = styled.input({
  position: 'absolute',
  width: 1,
  height: 1,
  opacity: 0,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
});
const ModalBackdrop = styled.div({
  position: 'fixed',
  zIndex: 1000,
  inset: 0,
  display: 'grid',
  placeItems: 'center',
  padding: 20,
  background: 'rgba(0,0,0,.45)',
});
const CropDialog = styled.div({
  width: 'min(100%, 440px)',
  padding: 24,
  borderRadius: 14,
  background: c.white,
  boxShadow: '0 16px 48px rgba(0,0,0,.22)',
  '& h2': { margin: 0, ...textStyle.h3_2 },
  '& p': { margin: '8px 0 18px', color: c.gray500, ...textStyle.body },
});
const CropFrame = styled.div<{ aspectRatio: number }>(({ aspectRatio }) => ({
  position: 'relative',
  width: '100%',
  aspectRatio,
  overflow: 'hidden',
  borderRadius: 10,
  background: c.gray900,
  cursor: 'grab',
  touchAction: 'none',
  '&:active': { cursor: 'grabbing' },
}));
const CropImagePreview = styled.img({
  position: 'absolute',
  maxWidth: 'none',
  userSelect: 'none',
  pointerEvents: 'none',
});
const CropActions = styled.div({
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 10,
  marginTop: 18,
});
const CropButton = styled('button', { shouldForwardProp: (prop) => prop !== 'primary' })<{
  primary?: boolean;
}>(({ primary }) => ({
  height: 40,
  border: primary ? 0 : `1px solid ${c.gray200}`,
  borderRadius: 6,
  background: primary ? c.primary : c.white,
  color: primary ? c.white : c.gray900,
  cursor: 'pointer',
  ...textStyle.label,
  '&:disabled': { opacity: 0.55, cursor: 'not-allowed' },
}));
