'use client';
import { useState } from 'react';
import styled from '@emotion/styled';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import {
  BizContent,
  SectionTitle,
  TableBox,
  THead,
  TRow,
  FieldSelect,
} from '@/components/biz/BizShell';
import { chartBars, chartMonths, dailyReport, hourlyReport } from '@/data/biz-design';

const Chart = styled.div({
  display: 'flex',
  alignItems: 'flex-end',
  gap: 18,
  height: 160,
  marginTop: 'auto',
});
const ChartCol = styled.div({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 8,
  flex: 1,
  ...textStyle.metaText,
  color: c.gray300,
});
const ChartBar = styled.span(({ h }: { h: number }) => ({
  width: '100%',
  height: `${h}%`,
  background: c.primary,
  borderRadius: '4px 4px 0 0',
}));
const ReportChartBox = styled(TableBox)({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: 20,
});
const Col = ({ w, children }: { w?: number; children: React.ReactNode }) => (
  <span style={{ width: w, flexShrink: 0 }}>{children}</span>
);

export function BizReportsPage() {
  const [period, setPeriod] = useState('8/25~8/27');
  const sum = (rows: { exposure: number; clicks: number }[]) => ({
    exposure: rows.reduce((acc, r) => acc + r.exposure, 0),
    clicks: rows.reduce((acc, r) => acc + r.clicks, 0),
  });
  const dailySum = sum(dailyReport);
  const hourlySum = sum(hourlyReport);
  return (
    <BizContent>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <SectionTitle>{period}까지의 리포트</SectionTitle>
          <FieldSelect
            aria-label="기간"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            style={{ width: 160 }}
          >
            <option>8/25~8/27</option>
            <option>8/25~8/31</option>
            <option>9/1~9/7</option>
          </FieldSelect>
        </span>
        <ReportChartBox style={{ height: 266 }}>
          <span style={textStyle.bodyStrong}>{dailySum.clicks.toLocaleString()} 클릭수</span>
          <Chart>
            {chartBars.map((h, i) => (
              <ChartCol key={chartMonths[i]}>
                <ChartBar h={h} />
                {chartMonths[i]}
              </ChartCol>
            ))}
          </Chart>
        </ReportChartBox>
      </div>
      <section aria-label="일별 리포트">
        <SectionTitle>일별 리포트</SectionTitle>
        <TableBox style={{ marginTop: 16 }}>
          <THead>
            <Col w={180}>날짜</Col>
            <Col w={180}>노출</Col>
            <Col w={180}>클릭</Col>
            <Col w={180}>클릭률</Col>
          </THead>
          <TRow>
            <Col w={180}>합계</Col>
            <Col w={180}>{dailySum.exposure.toLocaleString()}</Col>
            <Col w={180}>{dailySum.clicks.toLocaleString()}</Col>
            <Col w={180}>{((dailySum.clicks / dailySum.exposure) * 100).toFixed(1)}%</Col>
          </TRow>
          {dailyReport.map((r) => (
            <TRow key={r.date}>
              <Col w={180}>{r.date}</Col>
              <Col w={180}>{r.exposure.toLocaleString()}</Col>
              <Col w={180}>{r.clicks.toLocaleString()}</Col>
              <Col w={180}>{r.ctr}</Col>
            </TRow>
          ))}
        </TableBox>
      </section>
      <section aria-label="시간 리포트">
        <SectionTitle>시간 리포트</SectionTitle>
        <TableBox style={{ marginTop: 16 }}>
          <THead>
            <Col w={180}>시간</Col>
            <Col w={180}>노출</Col>
            <Col w={180}>클릭</Col>
            <Col w={180}>클릭률</Col>
          </THead>
          <TRow>
            <Col w={180}>합계</Col>
            <Col w={180}>{hourlySum.exposure.toLocaleString()}</Col>
            <Col w={180}>{hourlySum.clicks.toLocaleString()}</Col>
            <Col w={180}>{((hourlySum.clicks / hourlySum.exposure) * 100).toFixed(1)}%</Col>
          </TRow>
          {hourlyReport.map((r) => (
            <TRow key={r.hour}>
              <Col w={180}>{r.hour}</Col>
              <Col w={180}>{r.exposure.toLocaleString()}</Col>
              <Col w={180}>{r.clicks.toLocaleString()}</Col>
              <Col w={180}>{r.ctr}</Col>
            </TRow>
          ))}
        </TableBox>
      </section>
    </BizContent>
  );
}
