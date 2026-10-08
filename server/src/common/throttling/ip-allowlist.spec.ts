import { describe, expect, it } from 'vitest';
import { isIpAllowed, parseIpAllowlist } from './ip-allowlist.js';

describe('parseIpAllowlist', () => {
  it('parses exact IPv4, IPv4 CIDR and exact IPv6 entries', () => {
    expect(parseIpAllowlist(['1.2.3.4'])).toEqual([{ kind: 'ipv4', address: 0x01020304 }]);
    expect(parseIpAllowlist(['1.2.3.0/24'])).toEqual([
      { kind: 'ipv4-cidr', network: 0x01020300, mask: 0xffffff00 },
    ]);
    expect(parseIpAllowlist(['2001:DB8::1'])).toEqual([{ kind: 'ipv6', address: '2001:db8::1' }]);
  });

  it('skips blank entries', () => {
    expect(parseIpAllowlist(['', '   '])).toEqual([]);
  });

  it.each([
    '999.1.1.1',
    '1.2.3',
    'not-an-ip',
    '1.2.3.4/33',
    '1.2.3.4/-1',
    '1.2.3.4/abc',
    '1.2.3.4/',
    '1.2.3.4/16/8',
    '::1/64',
  ])('rejects the malformed entry "%s"', (entry) => {
    expect(() => parseIpAllowlist([entry])).toThrow();
  });
});

describe('isIpAllowed', () => {
  it('allows every source when the allowlist is empty (check disabled)', () => {
    expect(isIpAllowed('203.0.113.10', [])).toBe(true);
    expect(isIpAllowed('not-even-an-ip', [])).toBe(true);
  });

  it('matches exact IPv4 entries only', () => {
    const allowlist = parseIpAllowlist(['15.165.23.123']);
    expect(isIpAllowed('15.165.23.123', allowlist)).toBe(true);
    expect(isIpAllowed('15.165.23.124', allowlist)).toBe(false);
    expect(isIpAllowed('15.165.23.122', allowlist)).toBe(false);
  });

  it('matches IPv4 CIDR ranges including both boundaries', () => {
    const allowlist = parseIpAllowlist(['13.125.0.0/16']);
    expect(isIpAllowed('13.125.0.0', allowlist)).toBe(true);
    expect(isIpAllowed('13.125.255.255', allowlist)).toBe(true);
    expect(isIpAllowed('13.125.12.34', allowlist)).toBe(true);
    expect(isIpAllowed('13.124.255.255', allowlist)).toBe(false);
    expect(isIpAllowed('13.126.0.0', allowlist)).toBe(false);
  });

  it('treats /32 as an exact match and /0 as match-all', () => {
    expect(isIpAllowed('1.2.3.4', parseIpAllowlist(['1.2.3.4/32']))).toBe(true);
    expect(isIpAllowed('1.2.3.5', parseIpAllowlist(['1.2.3.4/32']))).toBe(false);
    expect(isIpAllowed('255.255.255.255', parseIpAllowlist(['0.0.0.0/0']))).toBe(true);
  });

  it('handles multiple entries and surrounding whitespace', () => {
    const allowlist = parseIpAllowlist(['  13.125.0.0/16 ', ' 15.165.23.123', ' ']);
    expect(isIpAllowed('13.125.0.1', allowlist)).toBe(true);
    expect(isIpAllowed('15.165.23.123', allowlist)).toBe(true);
    expect(isIpAllowed('15.165.23.122', allowlist)).toBe(false);
    expect(isIpAllowed('198.51.100.1', allowlist)).toBe(false);
  });

  it('matches IPv6 exactly, normalizing brackets and case', () => {
    const allowlist = parseIpAllowlist(['2001:db8::1']);
    expect(isIpAllowed('2001:DB8::1', allowlist)).toBe(true);
    expect(isIpAllowed('[2001:db8::1]', allowlist)).toBe(true);
    expect(isIpAllowed('2001:db8::2', allowlist)).toBe(false);
  });

  it('never matches IPv6 entries against IPv4 clients and vice versa', () => {
    expect(isIpAllowed('13.125.0.1', parseIpAllowlist(['2001:db8::1']))).toBe(false);
    expect(isIpAllowed('2001:db8::1', parseIpAllowlist(['13.125.0.0/16']))).toBe(false);
  });
});
