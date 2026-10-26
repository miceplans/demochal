'use client';

import { useEffect, useId, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import styled from '@emotion/styled';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { cropErrorMessage, readImage, type CropImage } from '@/lib/image-crop';
import { ImageCropModal } from '@/components/ui/ImageCropModal';

type Props = {
  busy?: boolean;
  compact?: boolean;
  label?: string;
  aspectRatio?: number;
  /** 광고가 실제로 노출되는 가로 px — 크롭 모달 미리보기를 이 크기로 맞춘다. */
  previewWidth?: number;
  onFileSelected: (file: File) => void;
};

export function AdImageUploader({
  busy = false,
  compact = false,
  label = '파일 찾기',
  aspectRatio = 1,
  previewWidth = 400,
  onFileSelected,
}: Props) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [image, setImage] = useState<CropImage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () => () => {
      if (image) URL.revokeObjectURL(image.url);
    },
    [image],
  );
  const chooseFile = async (file: File) => {
    if (busy) return;
    setError(null);
    try {
      setImage(await readImage(file));
    } catch (cause) {
      setImage(null);
      setError(cropErrorMessage(cause));
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
  const cancelCrop = () => {
    setImage(null);
    setError(null);
  };
  const confirmCrop = (file: File) => {
    URL.revokeObjectURL(image!.url);
    setImage(null);
    onFileSelected(file);
  };

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
        {error && !image ? <ErrorText role="alert">{error}</ErrorText> : null}
        <HiddenInput
          id={inputId}
          ref={inputRef}
          type="file"
          accept="image/*"
          disabled={busy || Boolean(image)}
          onChange={(event: ChangeEvent<HTMLInputElement>) => acceptFiles(event.target.files)}
        />
      </DropZone>
      {image ? (
        <ImageCropModal
          image={image}
          aspectRatio={aspectRatio}
          previewWidth={previewWidth}
          title="광고 이미지 위치 조정"
          description="드래그해서 광고에 보일 위치를 조정한 뒤 확인해주세요."
          previewAlt="광고 이미지 자르기 미리보기"
          onCancel={cancelCrop}
          onConfirm={confirmCrop}
        />
      ) : null}
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
const ErrorText = styled.span({
  display: 'block',
  marginTop: 8,
  color: c.red,
  ...textStyle.metaText,
});
const HiddenInput = styled.input({
  position: 'absolute',
  width: 1,
  height: 1,
  opacity: 0,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
});
