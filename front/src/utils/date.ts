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

/** 마감일이 지났으면 true. 마감일이 없거나 파싱 불가면 false. */
export function isPastDeadline(endDateIso: string | undefined, now: number = Date.now()): boolean {
  if (!endDateIso) return false;
  const end = new Date(endDateIso).getTime();
  return !Number.isNaN(end) && end < now;
}

/** Days remaining until an ISO end date, clamped to >= 0. Falsy/unparsable input -> 0. */
export function daysUntil(endDateIso: string | undefined, now: number = Date.now()): number {
  if (!endDateIso) return 0;
  const end = new Date(endDateIso).getTime();
  if (Number.isNaN(end)) return 0;
  return Math.max(0, Math.ceil((end - now) / MS_PER_DAY));
}

/** ISO datetime -> "M월 D일 오후 H:mm" 형태의 짧은 로컬 표기. Falsy/unparsable -> "-". */
export function formatTime(value?: string): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** ISO date/datetime -> "YYYY-MM-DD" (date 입력용). Falsy -> "". */
export function toDateInput(value: string | undefined): string {
  return value ? toDateKey(new Date(value)) : '';
}

/** ISO date/datetime -> "YYYY-MM-DDTHH:mm" (datetime-local 입력용). Falsy/unparsable -> "". */
export function toDateTimeInput(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${toDateKey(date)}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/** datetime-local 값을 ISO로 바꾼다. 빈 값은 null(점검 기간 초기화)이다. */
export function toIsoOrNull(local: string): string | null {
  if (!local) return null;
  const date = new Date(local);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** 접수/행사 기간을 "YYYY.MM.DD ~ YYYY.MM.DD"로 표기. 시작·종료 둘 중 하나만 있으면 빈 값. */
export function formatPeriod(startDate?: string, endDate?: string): string {
  const format = (value: string) => {
    const date = new Date(value);
    return `${date.getFullYear()}.${pad2(date.getMonth() + 1)}.${pad2(date.getDate())}`;
  };
  if (!startDate || !endDate) return '';
  return `${format(startDate)} ~ ${format(endDate)}`;
}

/** "YYYY-MM-DD" 키를 "M/D"로 표기. */
export function formatSlash(dateKey: string): string {
  const [, month, day] = dateKey.split('-');
  return `${Number(month)}/${Number(day)}`;
}
