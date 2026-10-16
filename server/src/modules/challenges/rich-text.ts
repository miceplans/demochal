import sanitizeHtml from 'sanitize-html';
import { env } from '../../config/env.js';

const COLOR_VALUE = [
  /^#[0-9a-f]{3,8}$/i,
  /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(?:,\s*(?:0|1|0?\.\d+)\s*)?\)$/i,
];
const ALLOWED_STYLES = {
  'font-size': [/^(?:[89]|[1-5]\d)px$/],
  color: COLOR_VALUE,
  'background-color': COLOR_VALUE,
  'text-align': [/^(?:left|center|right|justify)$/],
  'font-family': [/^[\w가-힣 "',-]{1,100}$/],
};

/**
 * 공고 상세정보(description) 서식 HTML 정화. 저장 전에 반드시 통과시켜 저장형 XSS를 막는다.
 * - 에디터가 만드는 서식 태그만 허용하고, 스크립트·이벤트 핸들러는 제거하며 style은 허용 목록(크기·색·글꼴·정렬)만 남긴다.
 * - 이미지는 우리 공개 에셋 도메인(PUBLIC_ASSETS_BASE_URL)만 허용한다(외부 추적 픽셀 방지).
 */
export function sanitizeDescription(html: string): string {
  const assetsBase = env.publicAssetsBaseUrl;
  return sanitizeHtml(html, {
    allowedTags: [
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
    ],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
      img: ['src', 'alt'],
      // 에디터가 만드는 글자 크기·색·글꼴·정렬만 style로 허용한다(아래 allowedStyles).
      span: ['style'],
      p: ['style'],
      div: ['style'],
      h2: ['style'],
      h3: ['style'],
      li: ['style'],
    },
    allowedStyles: { '*': ALLOWED_STYLES },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: { img: ['https', 'http'] },
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', {
        target: '_blank',
        rel: 'noopener noreferrer nofollow',
      }),
    },
    exclusiveFilter: (frame) =>
      frame.tag === 'img' &&
      !(assetsBase && (frame.attribs.src ?? '').startsWith(`${assetsBase}/`)),
  });
}
