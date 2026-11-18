import { describe, expect, it } from 'vitest';
import { isBizHostHeader, isBzHostHeader } from './biz';

describe('business host detection', () => {
  it('treats both biz and bz subdomains as business hosts', () => {
    expect(isBizHostHeader('biz.semochall.com')).toBe(true);
    expect(isBizHostHeader('bz.semochall.com')).toBe(true);
    expect(isBizHostHeader('www.semochall.com')).toBe(false);
  });

  it('identifies only the bz subdomain as the advertising product host', () => {
    expect(isBzHostHeader('bz.semochall.com')).toBe(true);
    expect(isBzHostHeader('BZ.semochall.com:443')).toBe(true);
    expect(isBzHostHeader('biz.semochall.com')).toBe(false);
    expect(isBzHostHeader('bzsemochall.com')).toBe(false);
    expect(isBzHostHeader(null)).toBe(false);
  });
});
