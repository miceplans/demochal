'use client';

import { useId, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import styled from '@emotion/styled';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';

type Props = {
  busy?: boolean;
  compact?: boolean;
  label?: string;
  onFileSelected: (file: File) => void;
};

export function AdImageUploader({
  busy = false,
  compact = false,
  label = '파일 찾기',
  onFileSelected,
}: Props) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const acceptFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (file) onFileSelected(file);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDragOver(false);
    if (!busy) acceptFiles(event.dataTransfer.files);
  };

  return (
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
        disabled={busy}
        onChange={(event: ChangeEvent<HTMLInputElement>) => acceptFiles(event.target.files)}
      />
    </DropZone>
  );
}

const DropZone = styled('label', {
  shouldForwardProp: (prop) => prop !== 'compact' && prop !== 'dragOver',
})<{
  compact: boolean;
  dragOver: boolean;
}>(({ compact, dragOver }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: compact ? 6 : 10,
  width: '100%',
  height: '100%',
  minHeight: 0,
  padding: 8,
  border: `2px dashed ${dragOver ? c.primary : '#dfedff'}`,
  borderRadius: 11,
  background: dragOver ? '#eaf3ff' : '#f8f8f8',
  cursor: 'pointer',
  textAlign: 'center',
  transition: 'border-color 120ms ease, background 120ms ease',
  '&:hover, &:focus-within': { borderColor: c.primary },
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
