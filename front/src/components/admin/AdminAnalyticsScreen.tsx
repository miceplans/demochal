'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import styled from '@emotion/styled';
import { generated } from '@semochal/api-client';
import { adReports } from '@/data/admin-design';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { AdminPageTitle, AdminSectionTitle, SectionHeader, StatCard, StatRow } from './parts';
import { ActivityChart, AdReportChart } from './charts';

function AdReportSection() {
  const searchParams = useSearchParams();
  const adNumber = Number(searchParams.get('ad'));
  const report = adReports.find((item) => item.adNumber === adNumber);
  if (!report) return null;
  return (
    <AdReportBlock aria-label={`빅배너 ${report.adNumber}번 리포트`}>
      <SectionHeader>
        <AdminSectionTitle>빅배너 -{report.adNumber}번 리포트</AdminSectionTitle>
        <span style={{ ...textStyle.metaText, color: c.gray500 }}>
          {report.organization} · {report.period}
        </span>
      </SectionHeader>
      <StatRow>
        {report.stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </StatRow>
      <AdReportChart daily={report.daily} />
    </AdReportBlock>
  );
}

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
      <Suspense fallback={null}>
        <AdReportSection />
      </Suspense>
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

const AdReportBlock = styled.div({ display: 'flex', flexDirection: 'column', gap: 24 });

const ExportButton = styled.button({
  border: 0,
  borderRadius: 10,
  background: '#0877FF',
  color: '#fff',
  padding: '12px 20px',
  ...({ fontSize: 14, fontWeight: 600 } as const),
  '&:hover': { background: '#0056c2' },
});
