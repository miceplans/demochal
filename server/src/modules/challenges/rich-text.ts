import sanitizeHtml from 'sanitize-html';
import { env } from '../../config/env.js';

/**
 * 공고 상세정보(description) 서식 HTML 정화. 저장 전에 반드시 통과시켜 저장형 XSS를 막는다.
 * - 에디터가 만드는 서식 태그만 허용하고, 스크립트·이벤트 핸들러·style 속성은 모두 제거한다.
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
      'a',
      'img',
    ],
    allowedAttributes: { a: ['href', 'target', 'rel'], img: ['src', 'alt'] },
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
