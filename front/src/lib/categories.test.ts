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

  it('단일 분야는 그대로 반환한다', () => {
    expect(splitCategories('창업/취업')).toEqual(['창업/취업']);
    expect(splitCategories('IT/SW')).toEqual(['IT/SW']);
  });

  it('크롤링 형태의 복수 종목을 종목별 태그로 분리하고 대상 어휘를 제외한다', () => {
    expect(splitCategories('아이디어·창업·마케팅·네이밍 일반인 대학생 대학원생 기타')).toEqual([
      '아이디어',
      '창업',
      '마케팅',
      '네이밍',
    ]);
    expect(splitCategories('사진·영상 디자인·그림·웹툰 제한없음')).toEqual([
      '사진',
      '영상',
      '디자인',
      '그림',
      '웹툰',
    ]);
    expect(
      splitCategories('아이디어·창업·마케팅·네이밍 과학·공학·학술 일반인 대학생 대학원생'),
    ).toEqual(['아이디어', '창업', '마케팅', '네이밍', '과학', '공학', '학술']);
  });

  it('분리·제외 뒤 남는 종목이 없으면 원본 토큰을 유지한다', () => {
    expect(splitCategories('일반인')).toEqual(['일반인']);
    expect(splitCategories('제한없음')).toEqual(['제한없음']);
  });

  it('콤마와 공백·구분점이 섞여도 종목별로 분리하고 중복을 제거한다', () => {
    expect(splitCategories('사진·영상, 사진·영상 디자인')).toEqual(['사진', '영상', '디자인']);
  });
});
