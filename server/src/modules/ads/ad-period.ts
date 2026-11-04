import { BadRequestException } from '@nestjs/common';

// 광고 계약 최대 기간(시작·종료일 포함 일수). 화면 달력의 AD_MAX_DAYS와 같은 값이다.
export const AD_MAX_DAYS = 365;

export function adToday(now = new Date()) {
  return new Date(new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10));
}

export function adPeriod(start: string, end: string) {
  const startDate = new Date(start.slice(0, 10));
  const endDate = new Date(end.slice(0, 10));
  if (
    ![startDate, endDate].every((date) => Number.isFinite(date.getTime())) ||
    startDate.toISOString().slice(0, 10) !== start.slice(0, 10) ||
    endDate.toISOString().slice(0, 10) !== end.slice(0, 10) ||
    startDate < adToday() ||
    endDate < startDate
  ) {
    throw new BadRequestException('오늘 이후의 올바른 광고 기간을 선택해 주세요.');
  }
  const days = Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1;
  if (days > AD_MAX_DAYS) {
    throw new BadRequestException(`광고 계약은 최대 1년(${AD_MAX_DAYS}일)까지 신청할 수 있습니다.`);
  }
  return { startDate, endDate, days };
}
