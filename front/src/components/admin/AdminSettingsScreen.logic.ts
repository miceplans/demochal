const MAINTENANCE_START_KEY = 'maintenanceStartAt';
const MAINTENANCE_END_KEY = 'maintenanceEndAt';

/** ISO 문자열을 datetime-local 입력값(로컬 YYYY-MM-DDTHH:mm)으로 바꾼다. null이면 빈 값. */
function toLocalInputValue(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

/** datetime-local 값을 ISO로 바꾼다. 빈 값은 null(점검 기간 초기화)이다. */
function toIsoOrNull(local: string): string | null {
  if (!local) return null;
  const date = new Date(local);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

type MaintenanceStatus = { label: string; tone: 'active' | 'scheduled' | 'ended' | 'none' };

/** 화면에 표시할 점검 상태 — 미저장 변경분이 있으면 그 값 기준으로 계산한다. */
function resolveStatus(
  startAt: string | null | undefined,
  endAt: string | null | undefined,
): MaintenanceStatus {
  if (!startAt || !endAt) return { label: '미설정', tone: 'none' };
  const start = new Date(startAt).getTime();
  const end = new Date(endAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return { label: '미설정', tone: 'none' };
  const now = Date.now();
  if (start <= now && now < end) return { label: '점검 진행 중', tone: 'active' };
  if (now < start) return { label: '점검 예정', tone: 'scheduled' };
  return { label: '점검 종료', tone: 'ended' };
}

export type { MaintenanceStatus };
export {
  MAINTENANCE_END_KEY,
  MAINTENANCE_START_KEY,
  resolveStatus,
  toIsoOrNull,
  toLocalInputValue,
};
