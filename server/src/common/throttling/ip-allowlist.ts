import { isIP } from 'node:net';

// Source-IP allowlist for the Toss webhook endpoint (payments.controller.ts).
// Dependency-free on purpose: IPv4 supports exact and CIDR entries; IPv6 is
// exact-match only, which is sufficient because Toss publishes IPv4 inbound
// ranges. Malformed entries throw at parse time so a typo fails boot loudly
// instead of silently widening or narrowing the allowlist.

export type IpAllowlistEntry =
  | { kind: 'ipv4'; address: number }
  | { kind: 'ipv4-cidr'; network: number; mask: number }
  | { kind: 'ipv6'; address: string };

export function parseIpAllowlist(entries: readonly string[]): IpAllowlistEntry[] {
  const parsed: IpAllowlistEntry[] = [];
  for (const entry of entries) {
    const value = entry.trim();
    if (!value) continue;
    parsed.push(parseEntry(value));
  }
  return parsed;
}

// An empty allowlist means the check is disabled (current behavior: every
// source passes and the service re-verification decides).
export function isIpAllowed(ip: string, allowlist: readonly IpAllowlistEntry[]): boolean {
  if (allowlist.length === 0) return true;
  const ipv4 = parseIpv4(ip);
  if (ipv4 !== null) {
    return allowlist.some((entry) =>
      entry.kind === 'ipv4'
        ? entry.address === ipv4
        : entry.kind === 'ipv4-cidr' && (ipv4 & entry.mask) >>> 0 === entry.network,
    );
  }
  const ipv6 = normalizeIpv6(ip);
  return (
    ipv6 !== null && allowlist.some((entry) => entry.kind === 'ipv6' && entry.address === ipv6)
  );
}

function parseEntry(value: string): IpAllowlistEntry {
  const slash = value.indexOf('/');
  if (value.indexOf('/', slash + 1) !== -1 || slash === value.length - 1) {
    throw new Error(`Invalid IP allowlist entry: "${value}"`);
  }
  const rawIp = slash === -1 ? value : value.slice(0, slash);
  const prefix = slash === -1 ? undefined : Number(value.slice(slash + 1));
  if (prefix !== undefined && (!Number.isInteger(prefix) || prefix < 0 || prefix > 128)) {
    throw new Error(`Invalid CIDR prefix in IP allowlist entry: "${value}"`);
  }
  const ipv4 = parseIpv4(rawIp);
  if (ipv4 !== null) {
    if (prefix === undefined) return { kind: 'ipv4', address: ipv4 };
    if (prefix > 32) throw new Error(`IPv4 CIDR prefix must be between 0 and 32: "${value}"`);
    // Shift counts are taken mod 32 in JS, so /0 needs an explicit zero mask.
    const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
    return { kind: 'ipv4-cidr', network: (ipv4 & mask) >>> 0, mask };
  }
  const ipv6 = normalizeIpv6(rawIp);
  if (ipv6 !== null) {
    if (prefix !== undefined) throw new Error(`IPv6 CIDR is not supported: "${value}"`);
    return { kind: 'ipv6', address: ipv6 };
  }
  throw new Error(`Invalid IP allowlist entry: "${value}"`);
}

function parseIpv4(value: string): number | null {
  if (isIP(value) !== 4) return null;
  return value.split('.').reduce((acc, part) => acc * 256 + Number(part), 0) >>> 0;
}

function normalizeIpv6(value: string): string | null {
  const unbracketed = value.startsWith('[') && value.endsWith(']') ? value.slice(1, -1) : value;
  return isIP(unbracketed) === 6 ? unbracketed.toLowerCase() : null;
}
