export interface TooltipEntry {
  dataKey?: string | number;
  name?: string | number;
  value?: string | number;
  color?: string;
  stroke?: string;
  fill?: string;
}

function arcPath(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number,
): string {
  const toPoint = (angle: number) => {
    const rad = (angle * Math.PI) / 180;
    return [cx + radius * Math.cos(rad), cy + radius * Math.sin(rad)] as const;
  };
  const [startX, startY] = toPoint(startAngle);
  const [endX, endY] = toPoint(endAngle);
  let delta = endAngle - startAngle;
  if (delta < 0) delta += 360;
  const largeArc = delta > 180 ? 1 : 0;
  return `M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArc} 1 ${endX} ${endY}`;
}

const TRAFFIC_TICK_COUNT = 5;

/** 시리즈 최댓값을 TRAFFIC_TICK_COUNT 등분했을 때 눈금이 정수로 떨어지는 상한. */
function trafficTop(values: number[]) {
  const max = Math.max(0, ...values);
  const step = Math.max(1, Math.ceil(max / TRAFFIC_TICK_COUNT));
  return step * TRAFFIC_TICK_COUNT;
}

export { arcPath, trafficTop, TRAFFIC_TICK_COUNT };
