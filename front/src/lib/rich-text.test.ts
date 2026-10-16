import { describe, expect, it } from 'vitest';
import { sanitizeRichHtml } from './rich-text';

describe('sanitizeRichHtml', () => {
  it('허용된 글자 크기·색·정렬·글꼴 style만 남긴다', () => {
    const html = sanitizeRichHtml(
      '<p style="text-align:center;position:fixed"><span style="font-size:24px;color:#ff0000;background-color:rgb(1,2,3);font-family:\'Noto Serif KR\', serif">a</span></p>',
    );
    expect(html).toMatch(/text-align:\s*center/);
    expect(html).toMatch(/font-size:\s*24px/);
    expect(html).toMatch(/color:\s*#ff0000/);
    expect(html).not.toContain('position');
  });

  it('허용 범위를 벗어난 style 값은 style 속성째 제거한다', () => {
    const html = sanitizeRichHtml(
      '<span style="font-size:200px;color:url(x);font-family:url(https://a.com)">a</span>',
    );
    expect(html).not.toContain('style');
  });

  it('위·아래 첨자 태그를 유지한다', () => {
    expect(sanitizeRichHtml('x<sup>2</sup><sub>1</sub>')).toBe('x<sup>2</sup><sub>1</sub>');
  });
});
