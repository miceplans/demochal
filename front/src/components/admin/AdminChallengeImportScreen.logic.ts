import type { generated } from '@semochal/api-client';

export type ImportRequest = Parameters<typeof generated.importAdminChallenge>[0];

// 서버 challenge-filter-options.ts · 비즈 공고 폼 카테고리와 같은 목록.
export const IMPORT_CATEGORIES = [
  'IT/SW',
  '디자인',
  '창업/취업',
  '기획',
  '광고/마케팅',
  '대회',
  '해외',
  '대외활동',
  '홍보',
  '강연/강의',
] as const;
export const IMPORT_TARGETS = [
  '어린이',
  '초등학생',
  '중학생',
  '고등학생',
  '대학생',
  '대학원생',
  '제한없음',
  '기타',
  '일반인',
  '기업',
] as const;
export const IMPORT_ORGANIZER_TYPES = [
  '중앙정부/기관',
  '대기업',
  '외국계기업',
  '학교/재단/협회',
  '학회/비영리단체',
  '진흥원',
  '언론',
  '지방자치단체',
  '중소/벤처기업',
  '기타',
] as const;

/** 포스터 카드 썸네일 비율(비즈 공고 폼 POSTER_THUMBNAIL_ASPECT와 같다). 2x 해상도로 만든다. */
export const THUMBNAIL_SIZE = { width: 832, height: 830 } as const;

export const IMPORT_TEMPLATE = JSON.stringify(
  [
    {
      title: '제5회 공공데이터 활용 아이디어 공모전',
      category: '대회',
      host: '행정안전부',
      supervisor: '한국지능정보사회진흥원',
      organizerType: '중앙정부/기관',
      targets: ['대학생', '일반인'],
      prizeAmount: 1000,
      startDate: '2026-11-20',
      endDate: '2026-12-31',
      recruitUrl: 'https://example.go.kr/apply',
      summary: '공공데이터로 사회문제를 해결할 아이디어를 모집합니다.',
      description: '공고 본문을 그대로 붙여넣으세요.\n\n빈 줄로 문단을 나눕니다.',
      hashtags: ['공공데이터', '아이디어'],
      inquiryContact: '02-000-0000',
    },
    {
      title: '대학생 서포터즈 10기',
      category: '대외활동',
      host: 'OO재단',
      targets: ['대학생'],
      startDate: '2026-11-20',
      endDate: '2026-12-10 18:00',
      recruitUrl: 'https://example.org/supporters',
      description: '서포터즈 활동 내용',
    },
  ],
  null,
  2,
);

export type ParsedRow = {
  key: string;
  payload: ImportRequest;
  errors: string[];
  warnings: string[];
};

/**
 * 날짜 입력을 KST 기준 ISO 문자열로 맞춘다. 'YYYY-MM-DD'(또는 YYYY.MM.DD)면 시작은 00:00,
 * 마감은 23:59:59로 채우고, 오프셋 없는 시각은 KST로 본다.
 */
export function toKstIso(value: unknown, edge: 'start' | 'end' = 'start'): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const raw = String(value)
    .trim()
    .replace(/^(\d{4})\.(\d{1,2})\.(\d{1,2})\.?/, '$1-$2-$3')
    .replace(/\s+/, 'T');
  let iso = raw;
  const dateOnly = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (dateOnly) {
    const [, y, m, d] = dateOnly;
    iso = `${y}-${m!.padStart(2, '0')}-${d!.padStart(2, '0')}T${edge === 'end' ? '23:59:59' : '00:00:00'}+09:00`;
  } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(raw)) {
    iso = `${raw.length === 16 ? `${raw}:00` : raw}+09:00`;
  }
  if (Number.isNaN(new Date(iso).getTime()))
    throw new Error(`날짜 형식을 해석할 수 없어요: ${value}`);
  return iso;
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 평문 상세정보를 문단(<p>) HTML로 바꾼다. 이미 HTML이면 그대로 둔다(서버가 정화한다). */
export function toDescriptionHtml(value: unknown): string {
  const text = String(value ?? '').trim();
  if (!text) return '';
  if (/<(p|div|br|ul|ol|h[1-6]|strong|b|table)\b/i.test(text)) return text;
  return text
    .split(/\n{2,}/)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

function cleanList(value: unknown): string[] | undefined {
  if (value === undefined || value === null) return undefined;
  const items = Array.isArray(value) ? value : String(value).split(',');
  const out = [
    ...new Set(items.map((item) => String(item).trim().replace(/^#/, '')).filter(Boolean)),
  ];
  return out.length ? out : undefined;
}

function text(value: unknown, max: number, field: string, errors: string[]) {
  if (value === undefined || value === null) return undefined;
  const result = String(value).trim();
  if (!result) return undefined;
  if (result.length > max)
    errors.push(`${field}: ${max}자 이하여야 해요(현재 ${result.length}자).`);
  return result;
}

const includes = <T extends string>(list: readonly T[], value: string): value is T =>
  (list as readonly string[]).includes(value);

/** 입력 항목 하나를 검증해 일괄 등록 요청 본문으로 만든다(파일 id는 등록 직전에 붙인다). */
export function normalizeImportItem(
  item: Record<string, unknown>,
  now: Date = new Date(),
): Omit<ParsedRow, 'key'> {
  const errors: string[] = [];
  const warnings: string[] = [];

  const title = text(item.title, 200, 'title', errors) ?? '';
  if (!title) errors.push('title(공고명)은 필수예요.');
  const host = text(item.host, 200, 'host', errors) ?? '';
  if (!host) errors.push('host(주최)는 필수예요. 이 이름의 기업 명의로 등록돼요.');
  const description = toDescriptionHtml(item.description);
  if (!description) errors.push('description(상세정보)은 필수예요.');

  const price = item.price === undefined || item.price === null ? 0 : Number(item.price);
  if (!Number.isInteger(price) || price < 0) errors.push('price(참가비)는 0 이상의 정수여야 해요.');

  let startDate = now.toISOString();
  let endDate = '';
  try {
    if (item.startDate === undefined) warnings.push('startDate가 없어 지금 시각으로 설정했어요.');
    else startDate = toKstIso(item.startDate, 'start') ?? startDate;
    endDate = toKstIso(item.endDate, 'end') ?? '';
    if (!endDate) errors.push('endDate(접수 마감일)는 필수예요.');
  } catch (error) {
    errors.push((error as Error).message);
  }
  if (startDate && endDate) {
    if (new Date(endDate) < new Date(startDate)) errors.push('endDate는 startDate 이후여야 해요.');
    else if (new Date(endDate) < now) warnings.push('접수 마감일이 이미 지났어요.');
  }

  const payload: ImportRequest = { title, host, description, price, startDate, endDate };

  try {
    const eventStart = toKstIso(item.eventStartDate, 'start');
    const eventEnd = toKstIso(item.eventEndDate, 'end');
    if (eventStart || eventEnd) {
      // 서버는 행사 기간을 시작·종료 쌍으로만 받는다 — 한쪽만 있으면 같은 날로 맞춘다.
      payload.eventStartDate = eventStart ?? toKstIso(item.eventEndDate, 'start');
      payload.eventEndDate = eventEnd ?? toKstIso(item.eventStartDate, 'end');
    }
  } catch (error) {
    errors.push((error as Error).message);
  }

  for (const key of ['supervisor', 'sponsor', 'supporter'] as const) {
    const value = text(item[key], 200, key, errors);
    if (value) payload[key] = value;
  }

  const category = text(item.category, 100, 'category', errors);
  if (!category) errors.push(`category는 필수예요(${IMPORT_CATEGORIES.join(', ')}).`);
  else {
    if (!includes(IMPORT_CATEGORIES, category))
      warnings.push(`category '${category}'는 표준 분류에 없어요.`);
    payload.category = category;
  }

  const targets = cleanList(item.targets);
  if (targets) {
    const invalid = targets.filter((target) => !includes(IMPORT_TARGETS, target));
    if (invalid.length) errors.push(`targets 허용값이 아니에요: ${invalid.join(', ')}`);
    else payload.targets = targets as ImportRequest['targets'];
    const targetOther = text(item.targetOther, 100, 'targetOther', errors);
    if (targets.includes('기타')) {
      if (targetOther) payload.targetOther = targetOther;
      else warnings.push("targets에 '기타'가 있지만 targetOther가 비어 있어요.");
    }
  }

  if (
    item.organizerType !== undefined &&
    item.organizerType !== null &&
    item.organizerType !== ''
  ) {
    const organizerType = String(item.organizerType);
    if (!includes(IMPORT_ORGANIZER_TYPES, organizerType))
      errors.push(`organizerType 허용값이 아니에요: ${organizerType}`);
    else payload.organizerType = organizerType as ImportRequest['organizerType'];
  }

  if (item.prizeAmount !== undefined && item.prizeAmount !== null && item.prizeAmount !== '') {
    const prize = Number(item.prizeAmount);
    if (!Number.isInteger(prize) || prize < 0)
      errors.push('prizeAmount(총상금, 만원 단위)는 0 이상의 정수여야 해요.');
    else payload.prizeAmount = prize;
  }

  const recruitMethod = item.recruitMethod ?? 'external';
  if (recruitMethod !== 'external' && recruitMethod !== 'seMOchall') {
    errors.push("recruitMethod는 'external' 또는 'seMOchall'이어야 해요.");
  } else {
    payload.recruitMethod = recruitMethod;
    if (recruitMethod === 'external') {
      const url = text(item.recruitUrl, 2048, 'recruitUrl', errors);
      if (!url)
        errors.push('recruitUrl(접수 링크)은 필수예요(세모챌 접수면 recruitMethod: seMOchall).');
      else if (!/^https?:\/\/\S+$/i.test(url))
        errors.push('recruitUrl은 http(s)://로 시작해야 해요.');
      else payload.recruitUrl = url;
    }
  }

  const summary = text(item.summary, 300, 'summary', errors);
  if (summary) payload.summary = summary;
  const inquiryContact = text(item.inquiryContact, 200, 'inquiryContact', errors);
  if (inquiryContact) payload.inquiryContact = inquiryContact;

  const hashtags = cleanList(item.hashtags);
  if (hashtags) {
    if (hashtags.length > 20) errors.push('hashtags는 20개 이하여야 해요.');
    if (hashtags.some((tag) => tag.length > 50)) errors.push('hashtag는 각 50자 이하여야 해요.');
    payload.hashtags = hashtags;
  }
  const topics = cleanList(item.topics);
  if (topics) {
    if (topics.length > 30) errors.push('topics는 30개 이하여야 해요.');
    payload.topics = topics;
  }
  if (item.visibility === 'private') payload.visibility = 'private';

  return { payload, errors, warnings };
}

/** 붙여넣은 JSON(객체 · 배열 · { contests: [...] })을 검증된 행 목록으로 만든다. */
export function parseImportInput(input: string, now: Date = new Date()): ParsedRow[] {
  let json: unknown;
  try {
    json = JSON.parse(input);
  } catch {
    throw new Error('JSON 형식이 올바르지 않아요. 예시 형식을 참고해 주세요.');
  }
  const items = Array.isArray(json)
    ? json
    : json && typeof json === 'object' && Array.isArray((json as { contests?: unknown }).contests)
      ? (json as { contests: unknown[] }).contests
      : json && typeof json === 'object'
        ? [json]
        : null;
  if (!items || items.length === 0) throw new Error('등록할 공고가 없어요.');
  return items.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return {
        key: `row-${index}`,
        payload: {} as ImportRequest,
        errors: ['공고 항목은 객체여야 해요.'],
        warnings: [],
      };
    }
    return { key: `row-${index}`, ...normalizeImportItem(item as Record<string, unknown>, now) };
  });
}

/** 포스터 상단 기준으로 카드 비율만큼 잘라 WebP 썸네일을 만든다(비즈 폼 크롭의 기본 위치와 같다). */
export async function makePosterThumbnail(poster: File): Promise<File> {
  const bitmap = await createImageBitmap(poster);
  const aspect = THUMBNAIL_SIZE.width / THUMBNAIL_SIZE.height;
  const cropWidth = Math.min(bitmap.width, bitmap.height * aspect);
  const cropHeight = cropWidth / aspect;
  const canvas = document.createElement('canvas');
  canvas.width = THUMBNAIL_SIZE.width;
  canvas.height = THUMBNAIL_SIZE.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('썸네일을 만들 수 없어요.');
  context.drawImage(
    bitmap,
    (bitmap.width - cropWidth) / 2,
    0,
    cropWidth,
    cropHeight,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/webp', 0.85),
  );
  if (!blob || blob.type !== 'image/webp') throw new Error('썸네일을 만들 수 없어요.');
  return new File([blob], `${poster.name.replace(/\.[^.]+$/, '') || 'poster'}-thumbnail.webp`, {
    type: 'image/webp',
  });
}
