// Admin screens consistently expect pre-formatted display strings (see
// AdminStatCard/BizReviewEntry/Report etc. in openapi.yaml) rather than raw
// numbers/dates — these helpers keep that formatting in one place.

export function formatCount(value: number): string {
  return value.toLocaleString('ko-KR');
}

export function formatWon(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `₩${(value / 1_000_000).toFixed(1)}M`;
  return `₩${value.toLocaleString('ko-KR')}`;
}

export function formatShortDate(date: Date): string {
  return `${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}

export function formatDday(target: Date, now = new Date()): string {
  const days = Math.ceil((target.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
  if (days === 0) return 'D-DAY';
  return days > 0 ? `D-${days}` : `D+${Math.abs(days)}`;
}

export function maskBizNumber(raw: string): string {
  if (raw.length !== 10) return raw;
  return `${raw.slice(0, 3)}-${raw.slice(3, 5)}-*****`;
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return email;
  const visible = local.slice(0, 1);
  return `${visible}${'*'.repeat(Math.max(1, local.length - 1))}@${domain}`;
}

export function maskName(name: string): string {
  if (name.length <= 1) return name;
  if (name.length === 2) return `${name[0]}*`;
  return `${name[0]}${'*'.repeat(name.length - 2)}${name[name.length - 1]}`;
}
