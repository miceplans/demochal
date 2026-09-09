'use client';

import { useState } from 'react';
import styled from '@emotion/styled';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import {
  activityChart,
  adRatio,
  trafficData,
  type TrafficRange,
} from '@/data/admin-design';

/* ---------- path helper (catmull-rom → cubic bezier) ---------- */

function smoothPath(points: [number, number][]): string {
  if (points.length < 2) return '';
  let d = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2[0]} ${p2[1]}`;
  }
  return d;
}

/* ---------- Donut: 유저 광고 비율 ---------- */

const ChartCard = styled.div({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: 24,
  border: '1px solid #DFE2E7',
  borderRadius: 16,
  background: c.white,
});

export function AdRatioChart() {
  const chartWidth = 280;
  const chartHeight = 168;
  const radius = 104;
  const strokeWidth = 26;
  const ratio = adRatio.ratio;
  const cx = chartWidth / 2;
  const cy = 140;
  // Semicircle gauge: 0 = left point (180°), 1 = right point (0°), sweeping over the top.
  const angle = Math.PI * (1 - ratio);
  const endX = cx + radius * Math.cos(angle);
  const endY = cy - radius * Math.sin(angle);
  const trackPath = `M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`;
  const valuePath = `M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${endX} ${endY}`;

  return (
    <ChartCard style={{ width: 420 }}>
      <span style={{ ...textStyle.body, color: c.gray500 }}>유저 광고 비율</span>
      <strong style={{ ...textStyle.h1, color: c.gray900 }}>{adRatio.value}</strong>
      <div style={{ position: 'relative', width: chartWidth, height: chartHeight, margin: '12px auto 0' }}>
        <svg
          width={chartWidth}
          height={chartHeight}
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          role="img"
          aria-label={`광고 비율 ${Math.round(ratio * 100)}%`}
        >
          <path d={trackPath} fill="none" stroke="#E5E7EB" strokeWidth={strokeWidth} strokeLinecap="round" />
          <path d={valuePath} fill="none" stroke={c.primary} strokeWidth={strokeWidth} strokeLinecap="round" />
          <circle cx={endX} cy={endY} r={14} fill={c.primary} stroke={c.white} strokeWidth={4} />
        </svg>
        <strong
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            textAlign: 'center',
            fontSize: 52,
            fontWeight: 700,
            color: c.gray900,
          }}
        >
          {Math.round(ratio * 100)}%
        </strong>
      </div>
    </ChartCard>
  );
}

/* ---------- Line chart: 유저 트래픽 ---------- */

const tabs: [TrafficRange, string][] = [
  ['7days', '7 days'],
  ['30days', '30 days'],
  ['1year', '1년'],
];

const Legend = styled.span({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 3,
  fontSize: 11,
  color: c.gray900,
});
const LegendDot = styled('span', { shouldForwardProp: (prop) => prop !== 'color' })<{ color: string }>(({ color }) => ({
  width: 8,
  height: 8,
  borderRadius: '50%',
  background: color,
}));
const TabContainer = styled.div({
  display: 'inline-flex',
  gap: 2,
  padding: 3,
  background: c.gray100,
  borderRadius: 8,
});
const Tab = styled.button<{ active?: boolean }>(({ active }) => ({
  border: 0,
  borderRadius: 6,
  padding: '4px 10px',
  background: active ? c.gray900 : 'transparent',
  color: active ? c.white : c.gray900,
  ...textStyle.finePrint,
}));

const yAxisLabels = ['0', '50k', '100k', '500k', '1M', '5M'];

export function TrafficChart() {
  const [range, setRange] = useState<TrafficRange>('1year');
  const { labels, primary, secondary } = trafficData[range];
  const width = 481;
  const height = 160;
  const maxY = Math.max(...primary) * 1.15;
  const stepX = width / (labels.length - 1);
  const toPoints = (values: number[]): [number, number][] =>
    values.map((value, i) => [i * stepX, height - (value / maxY) * height]);
  const primaryPoints = toPoints(primary);
  const secondaryPoints = toPoints(secondary);
  const primaryPath = smoothPath(primaryPoints);
  const secondaryPath = smoothPath(secondaryPoints);

  return (
    <div
      style={{
        flex: 1,
        minWidth: 544,
        border: '1px solid #DFE2E7',
        borderRadius: 12,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        background: c.white,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <strong style={{ ...textStyle.h2, color: c.gray900 }}>유저 트래픽</strong>
          <span style={{ display: 'flex', gap: 10 }}>
            <Legend>
              <LegendDot color={c.primary} />
              일반 유저 트래픽
            </Legend>
            <Legend>
              <LegendDot color={c.lightBlue} />
              비즈니스 트래픽
            </Legend>
          </span>
        </div>
        <TabContainer role="tablist" aria-label="기간 선택">
          {tabs.map(([value, text]) => (
            <Tab
              key={value}
              role="tab"
              aria-selected={range === value}
              active={range === value || undefined}
              onClick={() => setRange(value)}
            >
              {text}
            </Tab>
          ))}
        </TabContainer>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column-reverse',
            justifyContent: 'space-between',
            height,
            fontSize: 9,
            color: c.gray900,
            textAlign: 'right',
          }}
        >
          {yAxisLabels.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <svg
            viewBox={`0 0 ${width} ${height}`}
            width="100%"
            height={height}
            role="img"
            aria-label={`${range} 유저 트래픽 추이`}
          >
            <defs>
              <linearGradient id="traffic-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={c.primary} stopOpacity="0.18" />
                <stop offset="1" stopColor={c.primary} stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0.2, 0.4, 0.6, 0.8].map((ratio) => (
              <line
                key={ratio}
                x1="0"
                x2={width}
                y1={height * ratio}
                y2={height * ratio}
                stroke="#E5E7EB"
                strokeWidth="1"
              />
            ))}
            <path d={`${primaryPath} L ${width} ${height} L 0 ${height} Z`} fill="url(#traffic-area)" />
            <path d={secondaryPath} fill="none" stroke={c.lightBlue} strokeWidth="2.5" strokeLinecap="round" />
            <path d={primaryPath} fill="none" stroke={c.primary} strokeWidth="2.5" strokeLinecap="round" />
            {primaryPoints.map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r="2.6" fill={c.white} stroke={c.primary} strokeWidth="2" />
            ))}
          </svg>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, letterSpacing: '0.06em', color: c.gray900 }}>
            {labels.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Area chart: 리포트 활동 ---------- */

const months = activityChart.months;
const generalSeries = activityChart.general;
const corpSeries = activityChart.corp;
const yLabels = Array.from(
  { length: activityChart.yMax / 2 + 1 },
  (_, i) => i * 2,
);

export function ActivityChart() {
  const width = 1000;
  const height = 360;
  const padLeft = 34;
  const padTop = 20;
  const padBottom = 32;
  const maxY = activityChart.yMax;
  const stepX = width / (months.length - 1);
  const toPoints = (values: number[]): [number, number][] =>
    values.map((value, i) => [padLeft + i * stepX, padTop + height - (value / maxY) * height]);
  const generalPoints = toPoints(generalSeries);
  const corpPoints = toPoints(corpSeries);
  const generalPath = smoothPath(generalPoints);
  const corpPath = smoothPath(corpPoints);
  const tooltipIndex = activityChart.tooltipIndex;
  const [tipX, tipY] = generalPoints[tooltipIndex];

  return (
    <div
      style={{
        border: '1px solid #DFE2E7',
        borderRadius: 16,
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        background: c.white,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ ...textStyle.display, color: c.gray900 }}>활동</strong>
        <span style={{ display: 'flex', gap: 16 }}>
          <Legend>
            <LegendDot color={c.primary} />
            일반
          </Legend>
          <Legend>
            <LegendDot color={c.lightBlue} />
            기업
          </Legend>
        </span>
      </div>
      <svg
        viewBox={`0 0 ${padLeft + width} ${padTop + height + padBottom}`}
        width="100%"
        height={padTop + height + padBottom}
        role="img"
        aria-label="월간 활동 추이"
      >
        <defs>
          <linearGradient id="activity-general" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={c.primary} stopOpacity="0.25" />
            <stop offset="1" stopColor={c.primary} stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="activity-corp" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={c.lightBlue} stopOpacity="0.6" />
            <stop offset="1" stopColor={c.lightBlue} stopOpacity="0.05" />
          </linearGradient>
        </defs>
        {yLabels.map((label) => {
          const y = padTop + height - (label / maxY) * height;
          return (
            <g key={label}>
              <line x1={padLeft} x2={padLeft + width} y1={y} y2={y} stroke="#E5E7EB" strokeWidth="1" />
              <text x={padLeft - 10} y={y + 4} textAnchor="end" fontSize="12" fill={c.gray500}>
                {label}
              </text>
            </g>
          );
        })}
        <path
          d={`${corpPath} L ${padLeft + width} ${padTop + height} L ${padLeft} ${padTop + height} Z`}
          fill="url(#activity-corp)"
        />
        <path d={corpPath} fill="none" stroke={c.lightBlue} strokeWidth="3" strokeLinecap="round" />
        <path
          d={`${generalPath} L ${padLeft + width} ${padTop + height} L ${padLeft} ${padTop + height} Z`}
          fill="url(#activity-general)"
        />
        <path d={generalPath} fill="none" stroke={c.primary} strokeWidth="3" strokeLinecap="round" />
        <line
          x1={tipX}
          x2={tipX}
          y1={tipY - 14}
          y2={padTop + height}
          stroke={c.gray300}
          strokeWidth="1.5"
          strokeDasharray="5 5"
        />
        <g>
          <line x1={tipX - 34} x2={tipX + 34} y1={tipY - 46} y2={tipY - 46} stroke={c.primary} strokeWidth="2" />
          <line x1={tipX} x2={tipX} y1={tipY - 46} y2={tipY - 38} stroke={c.primary} strokeWidth="2" />
          <rect x={tipX - 28} y={tipY - 38} width="56" height="24" rx="6" fill={c.gray900} />
          <text x={tipX} y={tipY - 22} textAnchor="middle" fontSize="12" fontWeight="600" fill={c.white}>
            {activityChart.tooltipValue}
          </text>
          <circle cx={tipX} cy={tipY} r="5" fill={c.white} stroke={c.primary} strokeWidth="3" />
        </g>
        {months.map((label, i) => (
          <text
            key={label}
            x={padLeft + i * stepX}
            y={padTop + height + 24}
            textAnchor={i === 0 ? 'start' : i === months.length - 1 ? 'end' : 'middle'}
            fontSize="12"
            fill={c.gray900}
          >
            {label}
          </text>
        ))}
      </svg>
    </div>
  );
}
