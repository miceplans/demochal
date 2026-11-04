import { generated } from '@semochal/api-client';
import { toDateKey } from '@/lib/date';
import { organizerTypes } from '@/data/user-design';

type Attachment = { fileId: string; name: string; size: number };

type PostingInput = {
  title: string;
  description: string;
  /** Figma 폼에는 참가비 입력이 없어 신규는 0, 수정은 기존 값을 그대로 보존한다. */
  price: number;
  /** 접수 기간 — datetime-local 값(YYYY-MM-DDTHH:mm). */
  startDate: string;
  endDate: string;
  /** 행사 기간 — date 값(YYYY-MM-DD). 비우면 미정. */
  eventStartDate: string;
  eventEndDate: string;
  host: string;
  supervisor: string;
  sponsor: string;
  supporter: string;
  targetOther: string;
  attachments: Attachment[];
  category: string;
  posterUrl?: string | null;
  thumbnailFileId?: string | null;
  targets: NonNullable<generated.UpdateChallengeMutationBody['targets']>;
  organizerType: (typeof organizerTypes)[number] | null;
  prizeAmount: string;
  recruitMethod?: 'seMOchall' | 'external';
  recruitUrl?: string;
  summary?: string;
  hashtags?: string;
  topics?: string[];
  inquiryContact?: string;
  visibility?: 'public' | 'private';
};
// 생성/수정 API의 본문 타입과 1:1로 맞춘다 — `as` 캐스트 없이 mutate에 그대로 넘긬다.
// 폼에서 항상 값이 있는 핵심 필드는 필수로 좁혀, 수기 create 클라이언트의 Pick<Challenge, ...> 계약에도 맞는다.
type PostingValues = generated.UpdateChallengeMutationBody & {
  title: string;
  description: string;
  price: number;
  startDate: string;
  endDate: string;
  host: string;
  supervisor?: string | null;
  sponsor?: string | null;
  supporter?: string | null;
  targetOther?: string | null;
  eventStartDate?: string | null;
  eventEndDate?: string | null;
  attachments: Attachment[];
  category: string | null;
  recruitMethod?: 'seMOchall' | 'external';
  recruitUrl?: string;
  summary?: string | null;
  hashtags?: string[] | null;
  topics?: string[] | null;
  inquiryContact?: string | null;
  visibility?: 'public' | 'private';
};

const EMPTY_POSTING: PostingInput = {
  title: '',
  description: '',
  price: 0,
  startDate: '',
  endDate: '',
  eventStartDate: '',
  eventEndDate: '',
  host: '',
  supervisor: '',
  sponsor: '',
  supporter: '',
  targetOther: '',
  attachments: [],
  category: '',
  targets: [],
  organizerType: null,
  prizeAmount: '',
  visibility: 'public',
};

const ATTACHMENT_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  zip: 'application/zip',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  hwp: 'application/x-hwp',
  hwpx: 'application/hwp+zip',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};
const ATTACHMENT_ACCEPT = Object.keys(ATTACHMENT_TYPES)
  .map((ext) => `.${ext}`)
  .join(',');
const POSTER_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
// 카드 썸네일 슬롯 비율 — 크롭 모달 프레임과 OCR 위치 계산이 같이 쓴다.
const POSTER_THUMBNAIL_ASPECT = 416 / 415;
const MAX_ATTACHMENTS = 10;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

function attachmentContentType(file: File) {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return ATTACHMENT_TYPES[ext];
}

/**
 * 에디터 본문에 생긴 <font size/color/face>를 정화 화이트리스트에 맞는 <span style>로 바꾼다.
 * 평문만 붙여넣게 막아 두어 font 태그는 오직 에디터 명령(크기·색·글꼴)으로만 생긴다.
 * 캐럿만 있는 상태에서 명령을 적용하면 Chrome이 입력이 이어질 때 font 태그를 만들므로,
 * 입력 시점(onInput/compositionend)에 이 변환을 거쳐 저장 시 서식이 사라지지 않게 한다.
 * 캐럿이 font 안에 있으면 변환 뒤 같은 텍스트 오프셋으로 캐럿을 되살린다.
 */
export function normalizeFontTags(root: HTMLElement, fontSizePx: number | null) {
  const fonts = Array.from(root.querySelectorAll('font'));
  const selection = window.getSelection();
  let caret: { font: Element; offset: number } | null = null;
  if (fonts.length && selection?.rangeCount && selection.isCollapsed) {
    const node = selection.anchorNode;
    const host = (node instanceof Element ? node : node?.parentElement)?.closest('font');
    if (host && root.contains(host)) {
      // font 내부에서의 텍스트 오프셋을 복원 기준으로 기억한다.
      const range = selection.getRangeAt(0);
      const prefix = range.cloneRange();
      prefix.selectNodeContents(host);
      prefix.setEnd(range.endContainer, range.endOffset);
      caret = { font: host, offset: prefix.toString().length };
    }
  }
  for (const font of fonts) {
    const span = document.createElement('span');
    // 크기 7은 applyFontSize가 execCommand에 넘기는 고정 단계다.
    if (font.getAttribute('size') === '7' && fontSizePx) span.style.fontSize = `${fontSizePx}px`;
    const color = font.getAttribute('color');
    if (color) span.style.color = color;
    const face = font.getAttribute('face');
    if (face) span.style.fontFamily = face;
    span.append(...font.childNodes);
    font.replaceWith(span);
    // 캐럿을 새 span 안의 같은 오프셋으로 옮긴다.
    if (caret && caret.font === font && selection) {
      const restore = (container: Node, offset: number) => {
        const range = document.createRange();
        range.setStart(container, offset);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
      };
      let remaining = caret.offset;
      const walker = document.createTreeWalker(span, NodeFilter.SHOW_TEXT);
      let text = walker.nextNode();
      let restored = false;
      while (text) {
        const length = text.textContent?.length ?? 0;
        if (remaining <= length) {
          restore(text, remaining);
          restored = true;
          break;
        }
        remaining -= length;
        text = walker.nextNode();
      }
      if (!restored) restore(span, span.childNodes.length);
    }
  }
  // 서식 제거 뒤 남는 빈 style 잔재를 정리한다.
  root.querySelectorAll('[style]').forEach((el) => {
    if (!(el as HTMLElement).getAttribute('style')?.trim()) el.removeAttribute('style');
  });
}

/** 주소에 스킴이 없으면 https://를 붙여 http(s) URL로 정규화한다. 올바르지 않으면 null. */
function normalizeLinkUrl(raw: string) {
  const value = raw.trim();
  if (!value) return null;
  const url = /^[a-z][a-z\d+.-]*:/i.test(value) ? value : `https://${value}`;
  return isHttpUrl(url) ? url : null;
}

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function toDateInput(value: string | undefined) {
  return value ? toDateKey(new Date(value)) : '';
}

/** datetime-local 입력용 로컬 시각(YYYY-MM-DDTHH:mm). */
function toDateTimeInput(value: string | undefined) {
  if (!value) return '';
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${toDateKey(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export type { Attachment, PostingInput, PostingValues };
export {
  ATTACHMENT_ACCEPT,
  attachmentContentType,
  EMPTY_POSTING,
  escapeHtml,
  isHttpUrl,
  MAX_ATTACHMENTS,
  MAX_ATTACHMENT_BYTES,
  normalizeLinkUrl,
  POSTER_THUMBNAIL_ASPECT,
  POSTER_TYPES,
  toDateInput,
  toDateTimeInput,
};
