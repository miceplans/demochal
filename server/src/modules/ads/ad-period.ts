import { BadRequestException } from '@nestjs/common';

export function adToday(now = new Date()) {
  return new Date(new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10));
}

// 광고 종료일 상한: 오늘(KST)로부터 3개월. 먼 미래 예약·장기 계약으로 인한 금액 폭증(정수 범위
// 초과 포함)을 막는다.
export const AD_MAX_END_MONTHS = 3;

export function adMaxEndDate(now = new Date()) {
  const max = adToday(now);
  max.setUTCMonth(max.getUTCMonth() + AD_MAX_END_MONTHS);
  return max;
}

export function adPeriod(start: string, end: string, now = new Date()) {
  const startDate = new Date(start.slice(0, 10));
  const endDate = new Date(end.slice(0, 10));
  if (
    ![startDate, endDate].every((date) => Number.isFinite(date.getTime())) ||
    startDate.toISOString().slice(0, 10) !== start.slice(0, 10) ||
    endDate.toISOString().slice(0, 10) !== end.slice(0, 10) ||
    startDate < adToday(now) ||
    endDate < startDate
  ) {
    throw new BadRequestException('오늘 이후의 올바른 광고 기간을 선택해 주세요.');
  }
  if (endDate > adMaxEndDate(now)) {
    throw new BadRequestException(
      `광고 종료일은 오늘로부터 ${AD_MAX_END_MONTHS}개월 이내로 선택해 주세요.`,
    );
  }
  return {
    startDate,
    endDate,
    days: Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1,
  };
}
