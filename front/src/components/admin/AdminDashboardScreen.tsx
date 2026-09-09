'use client';

import styled from '@emotion/styled';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { dashboardStats } from '@/data/admin-design';
import {
  AdminSectionTitle,
  StatCard,
  StatRow,
} from './parts';
import { AdRatioChart, TrafficChart } from './charts';
import { ReportLogTable } from './ReportLogTable';

const ChartsRow = styled.div({ display: 'flex', gap: 24, alignItems: 'stretch', flexWrap: 'wrap' });

export function AdminDashboardScreen() {
  return (
    <>
      <ChartsRow>
        <AdRatioChart />
        <TrafficChart />
      </ChartsRow>
      <StatRow>
        {dashboardStats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </StatRow>
      <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <AdminSectionTitle style={{ color: '#111827' }}>신고 로그</AdminSectionTitle>
        <ReportLogTable />
      </section>
      <span style={{ ...textStyle.metaText, color: c.gray500 }}>2025.05.12 기준</span>
    </>
  );
}
