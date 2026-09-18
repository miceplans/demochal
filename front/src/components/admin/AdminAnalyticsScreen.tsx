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

type AdReport = generated.GetAdminAnalyticsQueryResult['data']['adReport'];

function AdReportSection({ report }: { report?: AdReport }) {
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

// `ad` 쿼리 파라미터를 URL에서 읽어 단일 useGetAdminAnalytics 쿼리에 포함시킨다.
// 광고 리포트가 필요한 요청도 전체 통계/활동 데이터를 함께 담아 오므로,
// 부모(전체 리포트)와 자식(광고별 리포트)이 각자 쿼리를 날리는 이중 요청을 막는다.
// useSearchParams는 Suspense 경계가 필요해 이 컴포넌트를 별도로 분리했다.
function AdminAnalyticsContent() {
  const searchParams = useSearchParams();
  const adParam = searchParams.get('ad');
  const adNumber = adParam ? Number(adParam) : undefined;
  const adEnabled = adNumber !== undefined && Number.isFinite(adNumber);

  const analyticsQuery = generated.useGetAdminAnalytics({ ad: adEnabled ? adNumber : undefined });
  const analytics = analyticsQuery.data?.data;

  return (
    <>
      <AdReportSection report={analytics?.adReport} />
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
        status={analyticsQuery.status}
      />
    </>
  );
}

export function AdminAnalyticsScreen() {
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <AdminPageTitle>리포트</AdminPageTitle>
        <ExportButton>내보내기</ExportButton>
      </div>
      <Suspense fallback={null}>
        <AdminAnalyticsContent />
      </Suspense>
    </>
  );
}
