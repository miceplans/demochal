import { describe, expect, it } from 'vitest';
import { sanitizeDescription } from './rich-text.js';

describe('sanitizeDescription', () => {
  it('서식 태그는 유지한다', () => {
    expect(sanitizeDescription('<p><b>굵게</b> <i>기울임</i></p><ul><li>a</li></ul>')).toBe(
      '<p><b>굵게</b> <i>기울임</i></p><ul><li>a</li></ul>',
    );
  });

  it('스크립트·이벤트 핸들러·javascript: 링크를 제거한다', () => {
    const out = sanitizeDescription(
      '<script>alert(1)</script><p onclick="x()">hi</p><a href="javascript:alert(1)">l</a>',
    );
    expect(out).not.toMatch(/script|onclick|javascript:/i);
  });

  it('링크에 noopener를 강제한다', () => {
    expect(sanitizeDescription('<a href="https://a.com">a</a>')).toContain('rel="noopener');
  });

  it('외부 도메인 이미지는 제거한다', () => {
    expect(sanitizeDescription('<img src="https://evil.example/x.png">')).toBe('');
  });
});
