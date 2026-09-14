'use client';

import styled from '@emotion/styled';
import { generated } from '@semochal/api-client';
import { AdminPageTitle, StatCard, StatRow } from './parts';
import { ActivityChart } from './charts';

export function AdminAnalyticsScreen() {
  const analyticsQuery = generated.useGetAdminAnalytics();
  const analytics = analyticsQuery.data?.data;
  const activity = analytics?.activity;

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <AdminPageTitle>리포트</AdminPageTitle>
        <ExportButton>내보내기</ExportButton>
      </div>
      <StatRow>
        {(analytics?.stats ?? []).map((stat) => (
          <StatCard key={stat.label} label={stat.label ?? ''} value={stat.value ?? ''} meta={stat.meta ?? ''} dot={stat.dot ?? undefined} />
        ))}
      </StatRow>
      {activity ? (
        <ActivityChart
          months={activity.months ?? []}
          general={activity.general ?? []}
          corp={activity.corp ?? []}
          yMax={activity.yMax ?? 10}
        />
      ) : null}
    </>
  );
}

const ExportButton = styled.button({
  border: 0,
  borderRadius: 10,
  background: '#0877FF',
  color: '#fff',
  padding: '12px 20px',
  ...({ fontSize: 14, fontWeight: 600 } as const),
  '&:hover': { background: '#0056c2' },
});
