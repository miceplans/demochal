import { describe, expect, it } from 'vitest';
import { splitCategories } from './categories';

describe('splitCategories', () => {
  it('콤마로 구분된 분야를 trim하고 중복 제거한다', () => {
    expect(splitCategories(' IT/SW,디자인,, IT/SW ')).toEqual(['IT/SW', '디자인']);
  });

  it('없는 분야는 빈 배열을 반환한다', () => {
    expect(splitCategories()).toEqual([]);
    expect(splitCategories(' , ')).toEqual([]);
  });
});
