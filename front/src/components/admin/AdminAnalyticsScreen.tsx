'use client';

import styled from '@emotion/styled';
import { analyticsStats } from '@/data/admin-design';
import { AdminPageTitle, StatCard, StatRow } from './parts';
import { ActivityChart } from './charts';

const ExportButton = styled.button({
  border: 0,
  borderRadius: 10,
  background: '#0877FF',
  color: '#fff',
  padding: '12px 20px',
  ...({ fontSize: 14, fontWeight: 600 } as const),
  '&:hover': { background: '#0056c2' },
});

export function AdminAnalyticsScreen() {
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <AdminPageTitle>리포트</AdminPageTitle>
        <ExportButton>내보내기</ExportButton>
      </div>
      <StatRow>
        {analyticsStats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </StatRow>
      <ActivityChart />
    </>
  );
}
