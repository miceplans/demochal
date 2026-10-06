import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdImageUploader } from './AdImageUploader';

describe('AdImageUploader', () => {
  beforeEach(() => {
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:source'),
      revokeObjectURL: vi.fn(),
    });
    vi.stubGlobal(
      'Image',
      class {
        naturalWidth = 1200;
        naturalHeight = 600;
        set src(_value: string) {
          queueMicrotask(() => this.onload?.());
        }
        onload?: () => void;
        onerror?: () => void;
      },
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('파일을 선택하면 업로드 전 crop 모달을 열고 취소 시 콜백을 호출하지 않는다', async () => {
    const onFileSelected = vi.fn();
    render(<AdImageUploader aspectRatio={2} onFileSelected={onFileSelected} />);
    fireEvent.change(screen.getByLabelText('파일 찾기'), {
      target: { files: [new File(['image'], 'banner.png', { type: 'image/png' })] },
    });

    expect(await screen.findByRole('dialog')).not.toBeNull();
    expect(screen.getByAltText('광고 이미지 자르기 미리보기')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    expect(onFileSelected).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('확인 시 crop 결과를 webp 파일로 전달한다', async () => {
    const onFileSelected = vi.fn();
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({ drawImage: vi.fn() })) as never;
    HTMLCanvasElement.prototype.toBlob = vi.fn((callback) =>
      callback(new Blob(['webp'], { type: 'image/webp' })),
    );
    render(<AdImageUploader aspectRatio={2} onFileSelected={onFileSelected} />);
    fireEvent.change(screen.getByLabelText('파일 찾기'), {
      target: { files: [new File(['image'], 'banner.png', { type: 'image/png' })] },
    });
    fireEvent.click(await screen.findByRole('button', { name: '확인' }));

    await waitFor(() => expect(onFileSelected).toHaveBeenCalledOnce());
    expect(onFileSelected.mock.calls[0][0]).toMatchObject({
      type: 'image/webp',
      name: 'banner.webp',
    });
  });
});
