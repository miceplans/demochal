const MS_PER_DAY = 86_400_000;

function pad2(value: number) {
  return String(value).padStart(2, '0');
}

/** ISO date/datetime string -> "YYYY.MM.DD". Falsy input -> "-", unparsable input -> original string. */
export function formatDateDot(value?: string): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getFullYear()}.${pad2(date.getMonth() + 1)}.${pad2(date.getDate())}`;
}

/** ISO date/datetime string -> "YYYY.MM.DD HH:mm". Falsy input -> "-", unparsable input -> original string. */
export function formatDateTimeDot(value?: string): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${formatDateDot(value)} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/** ISO datetime string -> "YYYY.MM.DD HH:mm" in Asia/Seoul (브라우저 TZ와 무관). Falsy -> "-", unparsable -> original. */
export function formatDateTimeDotKst(value?: string): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}.${parts.month}.${parts.day} ${parts.hour}:${parts.minute}`;
}

/** Date -> "YYYY-MM-DD" (e.g. for <input type="date">). */
export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** Days remaining until an ISO end date, clamped to >= 0. Falsy/unparsable input -> 0. */
export function daysUntil(endDateIso: string | undefined, now: number = Date.now()): number {
  if (!endDateIso) return 0;
  const end = new Date(endDateIso).getTime();
  if (Number.isNaN(end)) return 0;
  return Math.max(0, Math.ceil((end - now) / MS_PER_DAY));
}
