'use client';

import { useId } from 'react';
import { colors as c } from '@/styles/design';

const PAD_L = 40;
const LABEL_H = 28;
const TICKS = 4;

const niceMax = (value: number) => {
  if (value <= 0) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / magnitude / 4) * magnitude * 4;
};
const formatTick = (raw: number) => {
  const value = Number(raw.toFixed(2));
  return value >= 1000 ? `${value / 1000}k`.replace('.0k', 'k') : String(value);
};

/** 월/일 단위 영역 차트 (Figma 광고 노출수·클릭률 차트). 값은 nice 눈금으로 스케일한다. */
export function ExposureChart({
  bars,
  width = 347,
  height = 160,
  smooth = true,
}: {
  bars: { label?: string; value?: number }[];
  /** viewBox 기준 그래프 영역 크기 (축 라벨은 별도 여백) */
  width?: number;
  height?: number;
  smooth?: boolean;
}) {
  const gradientId = `exposure-fill-${useId().replace(/:/g, '')}`;
  const max = niceMax(Math.max(0, ...bars.map((b) => b.value ?? 0)));
  const step = bars.length > 1 ? width / (bars.length - 1) : width;
  const points = bars.map((b, i) => [PAD_L + i * step, height - ((b.value ?? 0) / max) * height]);
  const line = points
    .map(([x, y], i) => {
      if (i === 0) return `M${x},${y}`;
      if (!smooth) return `L${x},${y}`;
      const [px, py] = points[i - 1] as [number, number];
      const mid = (px + x) / 2;
      return `C${mid},${py} ${mid},${y} ${x},${y}`;
    })
    .join(' ');
  return (
    <svg
      viewBox={`0 0 ${PAD_L + width} ${height + LABEL_H}`}
      width="100%"
      role="img"
      aria-label="추이 차트"
      style={{ marginTop: 'auto' }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c.primary} stopOpacity="0.3" />
          <stop offset="1" stopColor={c.primary} stopOpacity="0" />
        </linearGradient>
      </defs>
      {Array.from({ length: TICKS + 1 }, (_, i) => {
        const y = (height / TICKS) * i;
        return (
          <g key={i}>
            <line
              x1={PAD_L}
              x2={PAD_L + width}
              y1={y}
              y2={y}
              stroke={c.gray200}
              strokeDasharray="3 3"
            />
            <text x={PAD_L - 8} y={y + 4} fontSize="12" fill={c.gray300} textAnchor="end">
              {formatTick((max / TICKS) * (TICKS - i))}
            </text>
          </g>
        );
      })}
      {points.length > 1 && (
        <>
          <path
            d={`${line} L${PAD_L + width},${height} L${PAD_L},${height} Z`}
            fill={`url(#${gradientId})`}
          />
          <path d={line} fill="none" stroke={c.primary} strokeWidth="2.5" strokeLinecap="round" />
        </>
      )}
      {bars.map((b, i) => (
        <text
          key={b.label ?? i}
          x={PAD_L + i * step}
          y={height + 20}
          fontSize="12"
          fill={c.gray300}
          textAnchor={i === 0 ? 'start' : i === bars.length - 1 ? 'end' : 'middle'}
        >
          {b.label}
        </text>
      ))}
    </svg>
  );
}
