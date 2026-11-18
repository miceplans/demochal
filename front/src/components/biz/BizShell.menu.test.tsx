import { describe, expect, it } from 'vitest';
import { bizMenu } from './BizShell';

describe('bizMenu', () => {
  it('bz 호스트는 디자인 상품 대신 광고 관리를 노출한다', () => {
    const hrefs = bizMenu(true).map(([href]) => href);
    expect(hrefs).toContain('/ads');
    expect(hrefs).not.toContain('/design-products');
  });

  it('biz 호스트는 디자인 상품을 노출한다', () => {
    const hrefs = bizMenu(false).map(([href]) => href);
    expect(hrefs).toContain('/design-products');
  });
});
