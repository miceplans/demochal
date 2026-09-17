'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import styled from '@emotion/styled';
import { generated } from '@semochal/api-client';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { AdminPageTitle, AdminSectionTitle, SectionHeader, StatCard, StatRow } from './parts';
import { ActivityChart, AdReportChart } from './charts';

const ExportButton = styled.button({
  border: 0,
  borderRadius: 10,
  background: '#0877FF',
  color: '#fff',
  padding: '12px 20px',
  ...({ fontSize: 14, fontWeight: 600 } as const),
  '&:hover': { background: '#0056c2' },
});

const AdReportBlock = styled.div({ display: 'flex', flexDirection: 'column', gap: 24 });

function AdReportSection() {
  const searchParams = useSearchParams();
  const adParam = searchParams.get('ad');
  const adNumber = adParam ? Number(adParam) : undefined;
  const reportQuery = generated.useGetAdminAnalytics(
    { ad: adNumber },
    { query: { enabled: adNumber !== undefined && Number.isFinite(adNumber) } },
  );
  const report = reportQuery.data?.data.adReport;
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
        {(report.stats ?? []).map((stat) => (
          <StatCard
            key={stat.label}
            label={stat.label ?? ''}
            value={stat.value ?? ''}
            meta={stat.meta ?? ''}
            dot={stat.dot ?? undefined}
          />
        ))}
      </StatRow>
      <AdReportChart
        daily={(report.daily ?? []).map((day) => ({
          date: day.date ?? '',
          impressions: day.impressions ?? 0,
          clicks: day.clicks ?? 0,
        }))}
      />
    </AdReportBlock>
  );
}

export function AdminAnalyticsScreen() {
  const analyticsQuery = generated.useGetAdminAnalytics({});
  const analytics = analyticsQuery.data?.data;

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
          <StatCard
            key={stat.label}
            label={stat.label ?? ''}
            value={stat.value ?? ''}
            meta={stat.meta ?? ''}
            dot={stat.dot ?? undefined}
          />
        ))}
      </StatRow>
      <ActivityChart
        months={analytics?.activity?.months}
        general={analytics?.activity?.general}
        corp={analytics?.activity?.corp}
        yMax={analytics?.activity?.yMax}
      />
    </>
  );
}
