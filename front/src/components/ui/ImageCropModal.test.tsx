import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ImageCropModal } from './ImageCropModal';
import type { CropImage } from '@/lib/image-crop';

const image: CropImage = {
  file: new File(['img'], 'poster.png', { type: 'image/png' }),
  url: 'blob:source',
  width: 800,
  height: 400,
};

const renderModal = (extra: Partial<Parameters<typeof ImageCropModal>[0]> = {}) =>
  render(
    <ImageCropModal
      image={image}
      aspectRatio={1}
      title="썸네일 영역 선택"
      previewAlt="포스터 썸네일 자르기 미리보기"
      onCancel={vi.fn()}
      onConfirm={vi.fn()}
      {...extra}
    />,
  );

// 원본 800x400(비율 2)에 1:1 프레임 → 가로만 넘친다. left = -position.x * 100%.
const previewLeft = () =>
  screen.getByAltText('포스터 썸네일 자르기 미리보기').style.left;
const cropFrame = () => screen.getByAltText('포스터 썸네일 자르기 미리보기').parentElement!;

describe('ImageCropModal 자동 위치', () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 400,
      height: 400,
      top: 0,
      left: 0,
      right: 400,
      bottom: 400,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);
    // jsdom은 PointerEvent를 지원하지만 setPointerCapture는 구현하지 않아 스텁이 필요하다.
    Element.prototype.setPointerCapture = vi.fn();
    Element.prototype.releasePointerCapture = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    delete (Element.prototype as { setPointerCapture?: unknown }).setPointerCapture;
    delete (Element.prototype as { releasePointerCapture?: unknown }).releasePointerCapture;
  });

  it('initialPosition이 없으면 기존처럼 중앙(0.5)에서 시작한다', () => {
    renderModal();
    expect(previewLeft()).toBe('-50%');
  });

  it('initialPosition이 있으면 그 위치에서 시작한다', () => {
    renderModal({ initialPosition: { x: 0.2, y: 0.5 } });
    expect(previewLeft()).toBe('-20%');
  });

  it('autoPosition이 도착하면 사용자가 건드리지 않았을 때만 위치를 적용한다', () => {
    const { rerender } = renderModal();
    expect(previewLeft()).toBe('-50%');
    rerender(
      <ImageCropModal
        image={image}
        aspectRatio={1}
        title="썸네일 영역 선택"
        previewAlt="포스터 썸네일 자르기 미리보기"
        autoPosition={{ x: 0.8, y: 0.5, seq: 1 }}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(previewLeft()).toBe('-80%');
  });

  it('사용자가 드래그로 조정한 뒤에는 늦게 도착한 autoPosition을 적용하지 않는다', () => {
    const props = {
      image,
      aspectRatio: 1,
      title: '썸네일 영역 선택',
      previewAlt: '포스터 썸네일 자르기 미리보기',
      onCancel: vi.fn(),
      onConfirm: vi.fn(),
    };
    const { rerender } = render(
      <ImageCropModal {...props} autoPosition={{ x: 0.8, y: 0.5, seq: 1 }} />,
    );
    expect(previewLeft()).toBe('-80%');
    // 프레임 표시 400px 기준으로 오버플로 400px: 400→200 드래그는 x 0.8에서 1.0(클램프)으로 이동한다.
    fireEvent.pointerDown(cropFrame(), { pointerId: 1, clientX: 400, clientY: 200 });
    fireEvent.pointerMove(cropFrame(), { pointerId: 1, clientX: 200, clientY: 200 });
    fireEvent.pointerUp(cropFrame(), { pointerId: 1, clientX: 200, clientY: 200 });
    expect(previewLeft()).toBe('-100%');
    rerender(<ImageCropModal {...props} autoPosition={{ x: 0.2, y: 0.5, seq: 2 }} />);
    expect(previewLeft()).toBe('-100%');
  });
});
