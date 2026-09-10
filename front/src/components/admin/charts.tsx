'use client';

import { useState } from 'react';
import styled from '@emotion/styled';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import {
  activityChart,
  adRatio,
  trafficData,
  type TrafficRange,
} from '@/data/admin-design';

/* ---------- shared tooltip ---------- */

interface TooltipEntry {
  dataKey?: string | number;
  name?: string | number;
  value?: string | number;
  color?: string;
  stroke?: string;
  fill?: string;
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: c.gray900,
        borderRadius: 6,
        padding: '8px 12px',
        color: c.white,
        fontSize: 12,
        lineHeight: 1.6,
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        whiteSpace: 'nowrap',
      }}
    >
      {label != null && <div style={{ fontWeight: 600, marginBottom: 2 }}>{label}</div>}
      {payload.map((entry) => (
        <div key={String(entry.dataKey)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: entry.stroke ?? entry.fill ?? entry.color,
            }}
          />
          <span>
            {entry.name}: {entry.value}
          </span>
        </div>
      ))}
    </div>
  );
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

function arcPath(cx: number, cy: number, radius: number, startAngle: number, endAngle: number): string {
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

function GaugeBar(props: {
  cx?: number;
  cy?: number;
  innerRadius?: number;
  outerRadius?: number;
  endAngle?: number;
  fill?: string;
}) {
  const { cx, cy, innerRadius, outerRadius, endAngle, fill } = props;
  if (cx == null || cy == null || innerRadius == null || outerRadius == null) return null;
  const mid = (innerRadius + outerRadius) / 2;
  const width = outerRadius - innerRadius;
  const rad = ((endAngle ?? 180) * Math.PI) / 180;
  const dotX = cx + mid * Math.cos(rad);
  const dotY = cy + mid * Math.sin(rad);
  return (
    <g>
      <path
        d={arcPath(cx, cy, mid, 180, 360)}
        fill="none"
        stroke="#E5E7EB"
        strokeWidth={width}
        strokeLinecap="round"
      />
      <path
        d={arcPath(cx, cy, mid, 180, endAngle ?? 180)}
        fill="none"
        stroke={fill}
        strokeWidth={width}
        strokeLinecap="round"
      />
      <circle cx={dotX} cy={dotY} r={14} fill={c.primary} stroke={c.white} strokeWidth={4} />
    </g>
  );
}

export function AdRatioChart() {
  const ratio = adRatio.ratio;
  const percent = Math.round(ratio * 100);

  return (
    <ChartCard style={{ width: 420 }}>
      <span style={{ ...textStyle.body, color: c.gray500 }}>유저 광고 비율</span>
      <strong style={{ ...textStyle.h1, color: c.gray900 }}>{adRatio.value}</strong>
      <div
        style={{
          position: 'relative',
          width: 280,
          height: 168,
          margin: '12px auto 0',
          overflow: 'hidden',
        }}
      >
        <RadialBarChart
          width={280}
          height={280}
          cx={140}
          cy={140}
          innerRadius={91}
          outerRadius={117}
          data={[{ ratio: percent }]}
          startAngle={180}
          endAngle={360}
        >
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
          <RadialBar
            dataKey="ratio"
            fill={c.primary}
            shape={<GaugeBar />}
            animationDuration={1400}
            animationEasing="ease-out"
          />
        </RadialBarChart>
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
          {percent}%
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
  const height = 160;
  const maxY = Math.max(...primary) * 1.15;
  const data = labels.map((label, i) => ({
    label,
    primary: primary[i],
    secondary: secondary[i],
  }));

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
        <div style={{ flex: 1, minWidth: 0, height, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <ResponsiveContainer width="100%" height={height}>
            <ComposedChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
              <defs>
                <linearGradient id="traffic-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor={c.primary} stopOpacity="0.18" />
                  <stop offset="1" stopColor={c.primary} stopOpacity="0" />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="#E5E7EB" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                interval={0}
                tick={{ fontSize: 9, fill: c.gray900, letterSpacing: '0.06em' }}
              />
              <YAxis domain={[0, maxY]} hide ticks={[maxY * 0.2, maxY * 0.4, maxY * 0.6, maxY * 0.8]} />
              <Tooltip
                content={<ChartTooltip />}
                cursor={{ stroke: c.gray300, strokeDasharray: '5 5', strokeWidth: 1.5 }}
              />
              <Area
                type="monotone"
                dataKey="primary"
                name="일반 유저 트래픽"
                stroke={c.primary}
                strokeWidth={2.5}
                strokeLinecap="round"
                fill="url(#traffic-area)"
                dot={{ r: 2.6, fill: c.white, stroke: c.primary, strokeWidth: 2 }}
                activeDot={{ r: 4, fill: c.white, stroke: c.primary, strokeWidth: 2 }}
              />
              <Line
                type="monotone"
                dataKey="secondary"
                name="비즈니스 트래픽"
                stroke={c.lightBlue}
                strokeWidth={2.5}
                strokeLinecap="round"
                dot={false}
                activeDot={{ r: 4, fill: c.white, stroke: c.lightBlue, strokeWidth: 2 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
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
  const data = months.map((month, i) => ({
    month,
    general: generalSeries[i],
    corp: corpSeries[i],
  }));

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
      <div style={{ width: '100%', height: 360 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
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
            <CartesianGrid vertical={false} stroke="#E5E7EB" />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12, fill: c.gray900 }}
              tickMargin={12}
            />
            <YAxis
              domain={[0, activityChart.yMax]}
              ticks={yLabels}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12, fill: c.gray500 }}
            />
            <Tooltip
              content={<ChartTooltip />}
              cursor={{ stroke: c.gray300, strokeDasharray: '5 5', strokeWidth: 1.5 }}
            />
            <Area
              type="monotone"
              dataKey="corp"
              name="기업"
              stroke={c.lightBlue}
              strokeWidth={3}
              strokeLinecap="round"
              fill="url(#activity-corp)"
              dot={false}
              activeDot={{ r: 5, fill: c.white, stroke: c.lightBlue, strokeWidth: 3 }}
            />
            <Area
              type="monotone"
              dataKey="general"
              name="일반"
              stroke={c.primary}
              strokeWidth={3}
              strokeLinecap="round"
              fill="url(#activity-general)"
              dot={false}
              activeDot={{ r: 5, fill: c.white, stroke: c.primary, strokeWidth: 3 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
