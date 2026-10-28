import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  matchedCenterToPosition,
  matchedRegionPosition,
  normalizeMatchText,
  recommendPosterCropPosition,
  TESSERACT_ASSET_PATHS,
  type OcrWord,
} from './poster-ocr';

describe('normalizeMatchText', () => {
  it('공백·특수문자를 제거하고 소문자로 통일한다', () => {
    expect(normalizeMatchText('2026 SEMO 해커톤!')).toBe('2026semo해커톤');
    expect(normalizeMatchText('  제 5 회  ')).toBe('제5회');
    expect(normalizeMatchText('ABC abc')).toBe('abcabc');
  });
});

describe('matchedCenterToPosition', () => {
  it('프레임이 넘치지 않는 축은 중앙(0.5)을 반환한다', () => {
    expect(matchedCenterToPosition({ x: 0.2, y: 0.8 }, { width: 1000, height: 1000 }, 1)).toEqual({
      x: 0.5,
      y: 0.5,
    });
  });

  it('가로가 넘치면 중심이 프레임 중앙에 오는 position을 계산한다', () => {
    // 2000x1000 이미지에 1:1 프레임 → cropWidth 1000. 중심 x 0.25 → (500-500)/1000 = 0
    expect(matchedCenterToPosition({ x: 0.25, y: 0.5 }, { width: 2000, height: 1000 }, 1)).toEqual({
      x: 0,
      y: 0.5,
    });
  });

  it('계산값은 0~1로 클램프된다', () => {
    expect(matchedCenterToPosition({ x: 1, y: 0.5 }, { width: 2000, height: 1000 }, 1)).toEqual({
      x: 1,
      y: 0.5,
    });
    expect(matchedCenterToPosition({ x: 0.5, y: 0.75 }, { width: 1000, height: 2000 }, 1)).toEqual({
      x: 0.5,
      y: 1,
    });
  });
});

describe('matchedRegionPosition', () => {
  const image = { width: 2000, height: 1000 };

  it('제목과 매칭된 텍스트 영역 중심으로 크롭 위치를 계산한다', () => {
    // '해커톤'은 제목 대상이므로 가중 10. 중심 x 0.3 → (0.3*2000-500)/1000 = 0.1
    const words: OcrWord[] = [{ text: '해커톤', bbox: { x0: 0.2, y0: 0.1, x1: 0.4, y1: 0.2 } }];
    const result = matchedRegionPosition(words, ['2026 해커톤 대회'], image, 1);
    expect(result?.x).toBeCloseTo(0.1);
    expect(result?.y).toBe(0.5);
  });

  it('제목 매칭 단어가 본문 매칭 단어보다 가중치가 높다', () => {
    // '공모전'(제목, 가중 6) x 0.3 + '모집'(본문, 가중 2) x 0.9 → (1.8+1.8)/8 = 0.45
    // x = (0.45*2000-500)/1000 = 0.4
    const words: OcrWord[] = [
      { text: '공모전', bbox: { x0: 0.2, y0: 0.1, x1: 0.4, y1: 0.2 } },
      { text: '모집', bbox: { x0: 0.8, y0: 0.1, x1: 1, y1: 0.2 } },
    ];
    expect(matchedRegionPosition(words, ['공모전', '신입 모집'], image, 1)?.x).toBeCloseTo(0.4);
  });

  it('띄어쓰기로 나뉜 제목 조각도 매칭된다', () => {
    // 전체 정규화('2026ai해커톤')에는 없지만 조각('해커톤')에는 포함되는 '해커'
    const words: OcrWord[] = [{ text: '해커', bbox: { x0: 0.4, y0: 0.1, x1: 0.6, y1: 0.2 } }];
    expect(matchedRegionPosition(words, ['2026 AI 해커톤'], image, 1)).not.toBeNull();
  });

  it('매칭되는 텍스트가 없으면 null을 반환한다', () => {
    const words: OcrWord[] = [{ text: '해커톤', bbox: { x0: 0.2, y0: 0.1, x1: 0.4, y1: 0.2 } }];
    expect(matchedRegionPosition(words, ['없는 제목'], image, 1)).toBeNull();
  });

  it('한 글자 단어는 무시한다', () => {
    const words: OcrWord[] = [{ text: '대', bbox: { x0: 0.2, y0: 0.1, x1: 0.4, y1: 0.2 } }];
    expect(matchedRegionPosition(words, ['대회'], image, 1)).toBeNull();
  });

  it('대상이 비어 있으면 null을 반환한다', () => {
    const words: OcrWord[] = [{ text: '해커톤', bbox: { x0: 0.2, y0: 0.1, x1: 0.4, y1: 0.2 } }];
    expect(matchedRegionPosition(words, [], image, 1)).toBeNull();
  });
});

describe('TESSERACT_ASSET_PATHS', () => {
  it('워커·코어·학습데이터를 모두 same-origin에서 자체 호스팅한다', () => {
    // front/next.config.ts의 CSP가 외부 CDN(jsdelivr 등)을 허용하지 않으므로
    // 기본 CDN 경로로 바뀌면 createWorker가 항상 실패한다 — same-origin 고정을 테스트로 잠근다.
    expect(Object.values(TESSERACT_ASSET_PATHS)).toEqual([
      '/tesseract/worker.min.js',
      '/tesseract/core',
      '/tesseract/lang-data',
    ]);
    for (const path of Object.values(TESSERACT_ASSET_PATHS)) {
      expect(path.startsWith('/')).toBe(true);
    }
  });
});

describe('recommendPosterCropPosition', () => {
  beforeEach(() => {
    // 실패 폰백 경로가 남기는 경고 로그를 테스트 출력에서 숨긴다.
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const stubImage = (onload: boolean, naturalWidth = 800, naturalHeight = 400) => {
    vi.stubGlobal(
      'Image',
      class {
        naturalWidth = naturalWidth;
        naturalHeight = naturalHeight;
        set src(_value: string) {
          queueMicrotask(() => (onload ? this.onload?.() : this.onerror?.()));
        }
        onload?: () => void;
        onerror?: () => void;
      },
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
    } as never);
  };

  it('인식 결과 좌표를 원본 비율로 환산해 위치를 계산한다', async () => {
    stubImage(true);
    // 캔버스 800x400(스케일 1)에서 '해커톤'이 (200,40)-(400,120)에 있으면
    // 원본 상대 중심 x 0.375, y 0.2. 원본 800x400에 1:1 프레임(cropWidth 400):
    // x = (0.375*800-200)/400 = 0.25, y는 세로 넘침이 없어 0.5
    const recognize = vi.fn().mockResolvedValue({
      words: [{ text: '해커톤', bbox: { x0: 200, y0: 40, x1: 400, y1: 120 } }],
    });
    const position = await recommendPosterCropPosition(
      { width: 800, height: 400, url: 'blob:poster' },
      ['제5회 해커톤'],
      1,
      recognize,
    );
    expect(recognize).toHaveBeenCalledOnce();
    expect(position?.x).toBeCloseTo(0.25);
    expect(position?.y).toBe(0.5);
  });

  it('이미지 로딩 실패 시 null을 반환해 중앙 기본값으로 폰백한다', async () => {
    stubImage(false);
    await expect(
      recommendPosterCropPosition(
        { width: 800, height: 400, url: 'blob:broken' },
        ['제목'],
        1,
        async () => ({ words: [] }),
      ),
    ).resolves.toBeNull();
  });

  it('인식 엔진 실패 시 null을 반환한다', async () => {
    stubImage(true);
    await expect(
      recommendPosterCropPosition(
        { width: 800, height: 400, url: 'blob:poster' },
        ['제목'],
        1,
        async () => {
          throw new Error('ocr failed');
        },
      ),
    ).resolves.toBeNull();
  });
});
