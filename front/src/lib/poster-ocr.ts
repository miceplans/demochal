// 공고 포스터에서 OCR로 텍스트 영역을 찾아 썸네일 크롭 위치(0~1)를 추천하는 클라이언트 유틸.
// 순수 함수(정규화·매칭·위치 계산)는 OCR 엔진과 분리해 단위 테스트에서 결과를 주입한다.

export type Position = { x: number; y: number };

export type OcrBbox = { x0: number; y0: number; x1: number; y1: number };

// bbox 좌표는 인식에 넘긴 이미지(다운스케일 캔버스) 픽셀 기준이다.
export type OcrWord = { text: string; bbox: OcrBbox };

export type RecognizeFn = (source: HTMLCanvasElement) => Promise<{ words: OcrWord[] }>;

export type PosterCropSource = { width: number; height: number; url: string };

// 크롭 모달(416x415 슬롯) 노출 폭의 2배보다 크게 잡아 OCR 정확도와 속도를 맞춘다.
const OCR_MAX_EDGE = 1600;
// 한 글자 매칭은 노이즈가 커서 두 글자 이상만 인정한다.
const MIN_MATCH_LENGTH = 2;
// 매칭 가중치 합이 이 값 미만이면 텍스트를 찾지 못한 것으로 본다(한글 두 글자 = 2).
const MIN_TOTAL_WEIGHT = 2;
// 제목 매칭 단어의 가중치 배수 — 제목 주변이 썸네일의 핵심이므로 본문 단어보다 우선한다.
const TITLE_WEIGHT_BONUS = 2;

// 매칭용 정규화: 소문자로 바꾸고 문자/숫자만 남긴다(공백·특수문자·대소문자 무시).
export function normalizeMatchText(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

// 각 대상에서 매칭 후보 구문을 뽑는다. 전체 문자열에 더해 공백으로 나뉜 조각도
// 등록해, "2026 해커톤 대회"처럼 띄어쓰기를 포함하는 제목이 포스터에서
// "해커톤"처럼 분할 인식돼도 매칭되게 한다.
function toPhrases(target: string): string[] {
  const phrases = new Set<string>();
  const full = normalizeMatchText(target);
  if (full.length >= MIN_MATCH_LENGTH) phrases.add(full);
  for (const part of target.split(/\s+/)) {
    const normalized = normalizeMatchText(part);
    if (normalized.length >= MIN_MATCH_LENGTH) phrases.add(normalized);
  }
  return [...phrases];
}

type ScoredWord = { word: OcrWord; weight: number };

function scoreWords(words: OcrWord[], phrasesByTarget: string[][]): ScoredWord[] {
  const scored: ScoredWord[] = [];
  for (const word of words) {
    const normalized = normalizeMatchText(word.text);
    if (normalized.length < MIN_MATCH_LENGTH) continue;
    // 첫 번째 대상(제목)부터 두 번째 대상(본문) 순으로 — 제목에 걸리면 본문 가중치는 적용하지 않는다.
    for (let targetIndex = 0; targetIndex < phrasesByTarget.length; targetIndex += 1) {
      const matched = phrasesByTarget[targetIndex].some((phrase) => phrase.includes(normalized));
      if (!matched) continue;
      const weight = normalized.length * (targetIndex === 0 ? TITLE_WEIGHT_BONUS : 1);
      scored.push({ word, weight });
      break;
    }
  }
  return scored;
}

// 매칭된 단어들의 (가중) 중심을 원본 이미지 내 상대 좌표(0~1)로 계산한다.
function matchedCenter(scored: ScoredWord[]): { x: number; y: number } | null {
  const total = scored.reduce((sum, item) => sum + item.weight, 0);
  if (total < MIN_TOTAL_WEIGHT) return null;
  let x = 0;
  let y = 0;
  for (const { word, weight } of scored) {
    const { x0, y0, x1, y1 } = word.bbox;
    x += ((x0 + x1) / 2) * weight;
    y += ((y0 + y1) / 2) * weight;
  }
  return { x: x / total, y: y / total };
}

// 이미지 크기와 프레임 비율이 주어지면, 프레임 중심이 center에 오는 position(0~1)을 계산한다.
// 프레임이 해당 축으로 넘칠 여지가 없으면 어느 값이든 같으므로 0.5를 쓴다.
export function matchedCenterToPosition(
  center: { x: number; y: number },
  image: { width: number; height: number },
  aspectRatio: number,
): Position {
  const sourceRatio = image.width / image.height;
  const cropWidth = sourceRatio > aspectRatio ? image.height * aspectRatio : image.width;
  const cropHeight = sourceRatio > aspectRatio ? image.height : image.width / aspectRatio;
  const clamp = (value: number) => Math.min(1, Math.max(0, value));
  const x =
    image.width <= cropWidth
      ? 0.5
      : clamp((center.x * image.width - cropWidth / 2) / (image.width - cropWidth));
  const y =
    image.height <= cropHeight
      ? 0.5
      : clamp((center.y * image.height - cropHeight / 2) / (image.height - cropHeight));
  return { x, y };
}

// OCR 단어 목록과 매칭 대상(첫 항목이 제목)으로 크롭 위치를 계산한다.
// 매칭되는 텍스트가 없으면 null — 호출부는 중앙(0.5, 0.5) 기본값으로 폰백한다.
export function matchedRegionPosition(
  words: OcrWord[],
  targets: string[],
  image: { width: number; height: number },
  aspectRatio: number,
): Position | null {
  const phrasesByTarget = targets.filter(Boolean).map(toPhrases);
  if (phrasesByTarget.length === 0) return null;
  const center = matchedCenter(scoreWords(words, phrasesByTarget));
  if (!center) return null;
  const { width, height } = image;
  return matchedCenterToPosition(center, { width, height }, aspectRatio);
}

// OCR 인식용으로 원본을 최대 긴 변 OCR_MAX_EDGE까지 축소한 캔버스를 만든다.
// 큰 원본을 그대로 인식하면 속도가 크게 느려지고, 작게 축소하면 한글 정확도가 떨어진다.
function drawForOcr(source: PosterCropSource): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, OCR_MAX_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext('2d');
      if (!context) {
        reject(new Error('이미지를 처리할 수 없어요.'));
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas);
    };
    image.onerror = () => reject(new Error('이미지를 읽을 수 없어요.'));
    image.src = source.url;
  });
}

// tesseract.js는 포스터를 골랐을 때만 지연 로딩한다 — 일반 페이지 로딩에 인식 엔진을 싣지 않기 위함.
const defaultRecognize: RecognizeFn = async (canvas) => {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker(['kor', 'eng']);
  try {
    const { data } = await worker.recognize(canvas);
    // 결과는 blocks → paragraphs → lines → words 계층으로 날아온다.
    const words: OcrWord[] = (data.blocks ?? []).flatMap((block) =>
      block.paragraphs.flatMap((paragraph) =>
        paragraph.lines.flatMap((line) =>
          line.words.flatMap((word) => {
            const { x0, y0, x1, y1 } = word.bbox ?? {};
            if ([x0, y0, x1, y1].some((value) => typeof value !== 'number')) return [];
            return [{ text: word.text, bbox: { x0, y0, x1, y1 } }];
          }),
        ),
      ),
    );
    return { words };
  } finally {
    await worker.terminate();
  }
};

// 포스터 이미지에서 텍스트를 인식해 크롭 위치를 추천한다.
// 인식 실패·매칭 실패 모두 null을 반환하므로 호출부는 에러 처리 없이 기본값으로 돌아갈 수 있다.
export async function recommendPosterCropPosition(
  source: PosterCropSource,
  targets: string[],
  aspectRatio: number,
  recognize: RecognizeFn = defaultRecognize,
): Promise<Position | null> {
  try {
    const canvas = await drawForOcr(source);
    const { words } = await recognize(canvas);
    // 인식은 다운스케일 캔버스 기준이므로 원본 픽셀로 환산한 뒤 상대 좌표로 병합한다.
    const restored = words.map((word) => ({
      text: word.text,
      bbox: {
        x0: word.bbox.x0 / canvas.width,
        y0: word.bbox.y0 / canvas.height,
        x1: word.bbox.x1 / canvas.width,
        y1: word.bbox.y1 / canvas.height,
      },
    }));
    return matchedRegionPosition(restored, targets, source, aspectRatio);
  } catch {
    return null;
  }
}
