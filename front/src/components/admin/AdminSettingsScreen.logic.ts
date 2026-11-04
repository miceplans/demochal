const MAINTENANCE_START_KEY = 'maintenanceStartAt';
const MAINTENANCE_END_KEY = 'maintenanceEndAt';

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
export { MAINTENANCE_END_KEY, MAINTENANCE_START_KEY, resolveStatus };
export { toDateTimeInput as toLocalInputValue, toIsoOrNull } from '@/utils/date';
