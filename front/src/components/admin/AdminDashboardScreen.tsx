'use client';

import { useState } from 'react';
import styled from '@emotion/styled';
import { generated } from '@semochal/api-client';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import type { TrafficRange } from '@/data/admin-design';
import { formatDateTimeDotKst as formatBaseDate } from '@/lib/date';
import { AdminSectionTitle, StatCard, StatRow } from './parts';
import { AdRatioChart, TrafficChart } from './charts';
import { ReportLogTable } from './ReportLogTable';

export function AdminDashboardScreen() {
  const [range, setRange] = useState<TrafficRange>('1year');
  const dashboardQuery = generated.useGetAdminDashboard({ range });
  const dashboard = dashboardQuery.data?.data;

  return (
    <>
      <ChartsRow>
        <AdRatioChart
          value={dashboard?.adRatio?.value ?? '0 ₩'}
          ratio={dashboard?.adRatio?.ratio ?? 0}
        />
        <TrafficChart
          range={range}
          onRangeChange={setRange}
          labels={dashboard?.traffic?.labels ?? []}
          primary={dashboard?.traffic?.primary ?? []}
          secondary={dashboard?.traffic?.secondary ?? []}
        />
      </ChartsRow>
      <StatRow>
        {(dashboard?.stats ?? []).map((stat) => (
          <StatCard
            key={stat.label}
            label={stat.label ?? ''}
            value={stat.value ?? ''}
            meta={stat.meta ?? ''}
            dot={stat.dot ?? undefined}
          />
        ))}
      </StatRow>
      <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <AdminSectionTitle style={{ color: '#111827' }}>신고 로그</AdminSectionTitle>
        <ReportLogTable reports={dashboard?.reports ?? []} />
      </section>
      {dashboard?.generatedAt && (
        <span style={{ ...textStyle.metaText, color: c.gray500 }}>
          {formatBaseDate(dashboard.generatedAt)} 기준 (KST)
        </span>
      )}
    </>
  );
}

const ChartsRow = styled.div({ display: 'flex', gap: 24, alignItems: 'stretch', flexWrap: 'wrap' });
