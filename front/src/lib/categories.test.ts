import { describe, expect, it } from 'vitest';
import { splitCategories } from './categories';

describe('splitCategories', () => {
  it('콤마로 구분된 분야를 trim하고 중복 제거한다', () => {
    expect(splitCategories(' IT/SW,디자인,, IT/SW ')).toEqual(['IT/SW', '디자인']);
  });

  it('가운데점으로 구분된 분야를 개별 태그로 분리한다', () => {
    expect(
      splitCategories('아이디어·창업·마케팅·네이밍·문학·학술·과학·공학·일반인·대학생·대학원생'),
    ).toEqual([
      '아이디어',
      '창업',
      '마케팅',
      '네이밍',
      '문학',
      '학술',
      '과학',
      '공학',
      '일반인',
      '대학생',
      '대학원생',
    ]);
  });

  it('쉼표와 가운데점이 섞여도 빈 값을 제외하고 분리한다', () => {
    expect(splitCategories(' 아이디어 · 창업, ,마케팅·창업 ')).toEqual([
      '아이디어',
      '창업',
      '마케팅',
    ]);
  });

  it('없는 분야는 빈 배열을 반환한다', () => {
    expect(splitCategories()).toEqual([]);
    expect(splitCategories(' , ')).toEqual([]);
  });
});
