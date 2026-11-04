'use client';

import { useCallback, useEffect, useId, useRef, useState, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import styled from '@emotion/styled';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { cropErrorMessage, makeCroppedFile, type CropImage } from '@/lib/image-crop';

type CropPosition = { x: number; y: number };

type Props = {
  image: CropImage;
  /** 크롭 프레임(=노출 슬롯)의 가로/세로 비율. */
  aspectRatio: number;
  /** 크롭 결과를 이 노출 폭의 2배 이상으로 만든다. */
  minOutputWidth?: number;
  /** 프레임 미리보기 폭(px) — 모달 폭을 이 크기에 맞춘다. */
  previewWidth?: number;
  title: string;
  description?: string;
  previewAlt: string;
  /**
   * 열린 뒤 늦게 도착하는 자동 추천 위치. 새 값이 도착할 때마다 적용하되,
   * 사용자가 한 번이라도 드래그했다면 건드리지 않는다. 없으면 무시.
   */
  autoPosition?: CropPosition | null;
  onCancel: () => void;
  onConfirm: (file: File) => void;
};

// 고정 비율 프레임 안에서 이미지를 드래그해 보일 위치를 고르고, 확인하면 해당 영역을
// 원본 해상도 WebP로 잘라 onConfirm에 넘긴다. AdImageUploader(광고)와 공고 포스터
// 썸네일이 같은 상호작용을 공유하기 위해 분리했다.
export function ImageCropModal({
  image,
  aspectRatio,
  minOutputWidth,
  previewWidth = 400,
  title,
  description,
  previewAlt,
  autoPosition,
  onCancel,
  onConfirm,
}: Props) {
  const titleId = useId();
  const [position, setPosition] = useState<CropPosition>({ x: 0.5, y: 0.5 });
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerX: number; pointerY: number; x: number; y: number } | null>(null);
  // OCR 자동 추천이 늦게 도착할 때 이미 사용자가 조정한 위치를 덮어쓰지 않게 한다.
  const touchedRef = useRef(false);

  useEffect(() => {
    if (autoPosition && !touchedRef.current) {
      setPosition(autoPosition);
    }
  }, [autoPosition]);

  const close = useCallback(() => {
    if (!processing) onCancel();
  }, [processing, onCancel]);
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [close]);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (processing) return;
    touchedRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerX: event.clientX, pointerY: event.clientY, ...position };
  };
  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const frame = frameRef.current;
    if (!drag || !frame) return;
    // 화면에 표시된 프레임 px 기준: 이미지가 프레임을 넘치는 만큼이 이동 가능 범위.
    const rect = frame.getBoundingClientRect();
    const sourceRatio = image.width / image.height;
    const overflowX = sourceRatio > aspectRatio ? rect.height * sourceRatio - rect.width : 0;
    const overflowY = sourceRatio > aspectRatio ? 0 : rect.width / sourceRatio - rect.height;
    const clamp = (value: number) => Math.min(1, Math.max(0, value));
    setPosition({
      x: overflowX > 0 ? clamp(drag.x - (event.clientX - drag.pointerX) / overflowX) : drag.x,
      y: overflowY > 0 ? clamp(drag.y - (event.clientY - drag.pointerY) / overflowY) : drag.y,
    });
  };
  const confirmCrop = async () => {
    if (processing) return;
    setProcessing(true);
    setError(null);
    try {
      const file = await makeCroppedFile(
        image,
        aspectRatio,
        position,
        minOutputWidth ?? previewWidth * 2,
      );
      onConfirm(file);
    } catch (cause) {
      // 모달을 유지해 사용자가 실패를 인지하고 다시 시도하거나 취소할 수 있게 한다.
      setError(cropErrorMessage(cause));
    } finally {
      setProcessing(false);
    }
  };

  const sourceRatio = image.width / image.height;
  const coverWidth = sourceRatio > aspectRatio ? `${(sourceRatio / aspectRatio) * 100}%` : '100%';
  const coverHeight = sourceRatio > aspectRatio ? '100%' : `${(aspectRatio / sourceRatio) * 100}%`;
  // 프레임 대비 %: 이미지가 넘치는 만큼 음수 방향으로 밀어 position(0~1)에 대응시킨다.
  const imageLeft =
    sourceRatio > aspectRatio ? `${-position.x * (sourceRatio / aspectRatio - 1) * 100}%` : '0%';
  const imageTop =
    sourceRatio > aspectRatio ? '0%' : `${-position.y * (aspectRatio / sourceRatio - 1) * 100}%`;

  if (typeof document === 'undefined') return null;
  return createPortal(
    <ModalBackdrop
      role="presentation"
      onMouseDown={(event) => event.currentTarget === event.target && close()}
    >
      <CropDialog
        previewWidth={previewWidth}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <h2 id={titleId}>{title}</h2>
        {description ? <p>{description}</p> : null}
        <CropFrame
          ref={frameRef}
          aspectRatio={aspectRatio}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={() => {
            dragRef.current = null;
          }}
          onPointerCancel={() => {
            dragRef.current = null;
          }}
        >
          <CropImagePreview
            src={image.url}
            alt={previewAlt}
            style={{
              width: coverWidth,
              height: coverHeight,
              left: imageLeft,
              top: imageTop,
            }}
          />
        </CropFrame>
        {error ? <ErrorText role="alert">{error}</ErrorText> : null}
        <CropActions>
          <CropButton type="button" onClick={close} disabled={processing}>
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
  );
}

const ModalBackdrop = styled.div({
  position: 'fixed',
  zIndex: 1000,
  inset: 0,
  display: 'grid',
  placeItems: 'center',
  padding: 20,
  background: 'rgba(0,0,0,.45)',
});
const CropDialog = styled.div<{ previewWidth: number }>(({ previewWidth }) => ({
  // 프레임(노출 크기) + 좌우 패딩 24*2
  width: `min(100%, ${previewWidth + 48}px)`,
  padding: 24,
  borderRadius: 14,
  background: c.white,
  boxShadow: '0 16px 48px rgba(0,0,0,.22)',
  '& h2': { margin: 0, ...textStyle.h3_2 },
  '& p': { margin: '8px 0 18px', color: c.gray500, ...textStyle.body },
}));
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
const ErrorText = styled.span({
  display: 'block',
  marginTop: 8,
  color: c.red,
  ...textStyle.metaText,
});
