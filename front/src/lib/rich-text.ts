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
  'a',
  'img',
];

const RICH_TAG =
  /<\/?(p|br|div|b|strong|i|em|u|s|strike|del|ul|ol|li|blockquote|hr|code|h2|h3|small|a|img)\b/i;

/** 서식 저장 도입 전의 평문 공고와 구분한다. */
export function isRichHtml(value: string) {
  return RICH_TAG.test(value);
}

export function sanitizeRichHtml(html: string) {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ['href', 'target', 'rel', 'src', 'alt'],
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:)/i,
  });
}
