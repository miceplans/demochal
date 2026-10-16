import DOMPurify from 'dompurify';

// 서버 `challenges/rich-text.ts`와 같은 허용 목록. 서버가 저장 시 정화하지만, 표시 직전에도 한 번 더 거른다.
const ALLOWED_TAGS = [
  'p',
  'br',
  'div',
  'b',
  'strong',
  'i',
  'em',
  'u',
  's',
  'strike',
  'del',
  'ul',
  'ol',
  'li',
  'blockquote',
  'hr',
  'code',
  'h2',
  'h3',
  'small',
  'span',
  'sup',
  'sub',
  'a',
  'img',
];

const RICH_TAG =
  /<\/?(p|br|div|b|strong|i|em|u|s|strike|del|ul|ol|li|blockquote|hr|code|h2|h3|small|span|sup|sub|a|img)\b/i;

/** 서식 저장 도입 전의 평문 공고와 구분한다. */
export function isRichHtml(value: string) {
  return RICH_TAG.test(value);
}

// 서버 `ALLOWED_STYLES`와 같은 허용 목록 — 글자 크기·색·글꼴·정렬 외의 style 선언은 버린다.
const COLOR_VALUE = [
  /^transparent$/,
  /^#[0-9a-f]{3,8}$/i,
  /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(?:,\s*(?:0|1|0?\.\d+)\s*)?\)$/i,
];
const ALLOWED_STYLES: Record<string, RegExp[]> = {
  'font-size': [/^(?:[89]|[1-5]\d)px$/],
  color: COLOR_VALUE,
  'background-color': COLOR_VALUE,
  'text-align': [/^(?:left|center|right|justify)$/],
  'font-family': [/^[\w가-힣 "',-]{1,100}$/],
};

function filterStyle(style: string) {
  return style
    .split(';')
    .map((declaration) => declaration.trim())
    .filter((declaration) => {
      const index = declaration.indexOf(':');
      if (index < 0) return false;
      const property = declaration.slice(0, index).trim().toLowerCase();
      const value = declaration.slice(index + 1).trim();
      return ALLOWED_STYLES[property]?.some((pattern) => pattern.test(value)) ?? false;
    })
    .join('; ');
}

let styleHookInstalled = false;
function installStyleHook() {
  if (styleHookInstalled) return;
  styleHookInstalled = true;
  DOMPurify.addHook('uponSanitizeAttribute', (_node, data) => {
    if (data.attrName !== 'style') return;
    data.attrValue = filterStyle(data.attrValue);
    if (!data.attrValue) data.keepAttr = false;
  });
}

export function sanitizeRichHtml(html: string) {
  installStyleHook();
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ['href', 'target', 'rel', 'src', 'alt', 'style'],
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:)/i,
  });
}
