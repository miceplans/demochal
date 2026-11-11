import { describe, expect, it } from 'vitest';
import legalCopy from './design-copy.json';

const LEGAL_KEYS = [
  'terms',
  'privacy',
  'advertisingPolicy',
  'youthProtection',
  'refundPolicy',
] as const;

const refundPolicyText = () => (legalCopy as Record<string, string[]>).refundPolicy.join('\n');

const PLACEHOLDER_PATTERN = /20XX|OOO|\[[^\]]*\]/;

describe('design-copy legal sections', () => {
  it.each(LEGAL_KEYS)('%s has no placeholder markers', (key) => {
    const paragraphs = (legalCopy as Record<string, string[]>)[key];
    const offenders = paragraphs.filter((paragraph) => PLACEHOLDER_PATTERN.test(paragraph));
    expect(offenders).toEqual([]);
  });

  it('refundPolicy states the statutory withdrawal and refund basics', () => {
    const policy = refundPolicyText();
    expect(policy).toContain('7일 이내');
    expect(policy).toContain('3개월 이내');
    expect(policy).toContain('3영업일 이내');
    expect(policy).toContain('법정 권리');
  });

  it('refundPolicy covers intangible goods, mismatch periods, continuous contracts and delay damages', () => {
    const policy = refundPolicyText();
    expect(policy).toContain('무형상품');
    for (const scope of ['광고·노출', '디지털 콘텐츠', '용역형 서비스']) {
      expect(policy).toContain(scope);
    }
    expect(policy).toContain('제공이 개시된 경우');
    expect(policy).toContain('30일 이내');
    expect(policy).toContain('계속적 이용계약');
    expect(policy).toContain('결제하신 수단');
    expect(policy).toContain('지연배상금');
    expect(policy).toContain('미제공 부분과 회사의 귀책 여부');
    expect(policy).toContain('mice@miceplans.com');
    expect(policy).toContain('청약철회 또는 계약 해제');
    expect(policy).toContain('일할 계산');
    expect(policy).toContain('제작물이 포함된 상품');
  });

  it('refundPolicy does not use blanket no-refund wording', () => {
    const policy = refundPolicyText();
    expect(policy).not.toMatch(
      /환불(이)? 불가|환불하지 않습니다|환불되지 않습니다|환불할 수 없습니다|일체 환불/,
    );
  });
});
