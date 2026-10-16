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

  it('허용된 글자 크기·색·정렬·글꼴 style만 남기고 나머지는 제거한다', () => {
    const out = sanitizeDescription(
      '<p style="text-align:center;position:fixed"><span style="font-size:24px;color:#ff0000;background-color:rgb(1,2,3);font-family:\'Noto Serif KR\', serif">a</span></p>',
    );
    expect(out).toContain('text-align:center');
    expect(out).toContain('font-size:24px');
    expect(out).toContain('color:#ff0000');
    expect(out).toContain('background-color:rgb(1,2,3)');
    expect(out).not.toContain('position');
  });

  it('허용 범위를 벗어난 style 값(url(), 큰 글자 등)은 제거한다', () => {
    const out = sanitizeDescription(
      '<span style="font-size:200px;color:url(x);font-family:url(https://a.com)">a</span>',
    );
    expect(out).not.toMatch(/font-size|url|color|font-family/);
  });
});
