'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import styled from '@emotion/styled';
import { generated } from '@semochal/api-client';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { downloadCsv } from '@/lib/csv';
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
  const downloadAnalytics = () => {
    const rows: string[][] = [];
    for (const stat of analytics?.stats ?? []) {
      rows.push(['통계', stat.label ?? '', stat.value ?? '', stat.meta ?? '']);
    }
    for (const [index, month] of (analytics?.activity?.months ?? []).entries()) {
      rows.push([
        '활동',
        month ?? '',
        String(analytics?.activity?.general?.[index] ?? 0),
        `기업 ${analytics?.activity?.corp?.[index] ?? 0}`,
      ]);
    }
    if (analytics?.adReport) {
      for (const stat of analytics.adReport.stats ?? []) {
        rows.push(['광고 리포트', stat.label ?? '', stat.value ?? '', stat.meta ?? '']);
      }
      for (const day of analytics.adReport.daily ?? []) {
        rows.push([
          '광고 일별',
          day.date ?? '',
          String(day.impressions ?? 0),
          `클릭 ${day.clicks ?? 0}, CTR ${day.ctr ?? 0}`,
        ]);
      }
    }
    downloadCsv('semochal-analytics.csv', ['구분', '항목', '값', '비고'], rows);
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24 }}>
        <ExportButton type="button" onClick={downloadAnalytics}>
          내보내기
        </ExportButton>
      </div>
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
      </div>
      <Suspense fallback={null}>
        <AdminAnalyticsContent />
      </Suspense>
    </>
  );
}
