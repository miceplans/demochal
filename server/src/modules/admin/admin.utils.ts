import { sql } from 'drizzle-orm';

export const countRows = sql<number>`count(*)::int`;

/** ilike 검색어의 %, _, 역슬래시를 이스케이프해 리터럴 부분 문자열로 매칭한다. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}
export const like = (value: string) => `%${escapeLike(value)}%`;

/** 'kim.dev@gmail.com' → 'k***@gmail.com' (local part first char + '***'). */
export function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at <= 0) return `${email.charAt(0)}***`;
  return `${email.charAt(0)}***${email.slice(at)}`;
}

/** '123-45-67890' → '123-45-*****' (keep the first two digit groups, trailing dash included). */
export function maskBizNumber(registrationNumber: string): string {
  return `${registrationNumber.slice(0, 7)}*****`;
}

export const formatMonthDay = (date: Date) =>
  `${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;

export const formatMonthDayShort = (date: Date) => `${date.getMonth() + 1}/${date.getDate()}`;
