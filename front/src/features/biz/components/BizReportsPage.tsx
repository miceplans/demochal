'use client';

import { useEffect, useState } from 'react';
import { LoadingState } from '@/components/common/LoadingState';
import { useRouter, useSearchParams } from 'next/navigation';
import styled from '@emotion/styled';
import { generated } from '@semochal/api-client';
import { ExposureChart } from '@/components/biz/ExposureChart';
import { BizContent, useBizHref } from '@/components/biz/BizShell';
import { Dropdown } from '@/components/ui/Dropdown';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { apiErrorMessage } from '@/lib/api-error';

const formatMonthDay = (iso: string) => {
  const [, month, day] = iso.slice(0, 10).split('-');
  return `${Number(month)}/${Number(day)}`;
};

type MetricRow = { key: string; label: string; impressions: number; clicks: number; ctr: number };

function ReportTable({
  labelHeader,
  totals,
  rows,
}: {
  labelHeader: string;
  totals: { impressions: number; clicks: number; ctr: number };
  rows: MetricRow[];
}) {
  return (
    <Table>
      <Row head>
        <span>{labelHeader}</span>
        <span>노출</span>
        <span>클릭</span>
        <span>클릭률</span>
      </Row>
      {[{ key: 'total', label: '합계', ...totals }, ...rows].map((row) => (
        <Row key={row.key}>
          <span>{row.label}</span>
          <span>{row.impressions.toLocaleString()}</span>
          <span>{row.clicks.toLocaleString()}</span>
          <span>{row.ctr}%</span>
        </Row>
      ))}
    </Table>
  );
}

export function BizReportsPage() {
  const router = useRouter();
  const hrefOf = useBizHref();
  const searchParams = useSearchParams();
  const requestedId = searchParams.get('adId');

  const adsQuery = generated.useListMyAds();
  const ads = adsQuery.data?.status === 200 ? adsQuery.data.data : [];

  const [selectedId, setSelectedId] = useState(requestedId ?? '');
  const [initialized, setInitialized] = useState(false);
  useEffect(() => {
    if (!initialized && adsQuery.data) {
      const id =
        requestedId && ads.some((item) => item.id === requestedId)
          ? requestedId
          : (ads[0]?.id ?? '');
      // 광고 목록이 처음 도착했을 때만 selectedId를 정한다(이후는 사용자의 드롭다운 선택이 우선).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedId(id);
      setInitialized(true);
    }
    // ads/requestedId는 최초 진입 시 한 번만 selectedId를 정하는 데 쓰이고,
    // 이후 selectedId는 사용자의 드롭다운 선택이 진실의 원천이다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adsQuery.data, initialized]);

  const reportQuery = generated.useGetAdReport(selectedId, undefined, {
    query: { enabled: !!selectedId },
  });
  const report = reportQuery.data?.data;

  const loading = adsQuery.isPending || (!!selectedId && reportQuery.isPending);
  const error = adsQuery.isError || reportQuery.isError;

  const selectAd = (id: string) => {
    setSelectedId(id);
    router.replace(hrefOf(`/reports?adId=${encodeURIComponent(id)}`));
  };
  if (loading)
    return (
      <BizContent>
        <LoadingState label="리포트를 불러오는 중입니다." />
      </BizContent>
    );
  if (error)
    return (
      <BizContent>
        <p role="alert">
          {apiErrorMessage(
            adsQuery.error ?? reportQuery.error,
            '성과 리포트를 불러오지 못했습니다.',
          )}
        </p>
      </BizContent>
    );
  const ad = ads.find((item) => item.id === selectedId);
  if (!report || !ad)
    return (
      <BizContent>
        <p>조회할 광고 성과 데이터가 없습니다.</p>
      </BizContent>
    );
  const period = `${formatMonthDay(ad.startDate)}~${formatMonthDay(ad.endDate)}`;
  return (
    <BizContent style={{ gap: 32 }}>
      <Banner>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {ad.imageUrl ? <img src={ad.imageUrl} alt={ad.title} /> : null}
      </Banner>
      <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Heading>{period}까지의 리포트</Heading>
        <ChartCard>
          <ChartTitle>{report.totals.clicks.toLocaleString()} 클릭수</ChartTitle>
          <ExposureChart bars={report.monthlyClicks} width={1000} height={160} />
        </ChartCard>
      </section>
      <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <HeadingRow>
          <Heading>{period}까지의 리포트</Heading>
          <Dropdown
            aria-label="광고 선택"
            options={ads.map((item) => ({ value: item.id, label: item.title }))}
            value={selectedId}
            onChange={selectAd}
            width={160}
          />
        </HeadingRow>
        <ReportTable
          labelHeader="날짜"
          totals={report.totals}
          rows={report.daily.map((row) => ({ ...row, key: row.date, label: row.date }))}
        />
      </section>
      <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Heading>시간 리포트</Heading>
        <ReportTable
          labelHeader="시간"
          totals={report.totals}
          rows={report.hourly.map((row) => ({ ...row, key: String(row.hour) }))}
        />
      </section>
    </BizContent>
  );
}

const Banner = styled.div({
  height: 236,
  borderRadius: 12,
  background: c.gray100,
  overflow: 'hidden',
  '& img': { width: '100%', height: '100%', objectFit: 'cover' },
});
const Heading = styled.h2({ margin: 0, ...textStyle.h2_2, color: c.gray900 });
const HeadingRow = styled.div({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
});
const ChartCard = styled.div({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: 20,
  border: `0.5px solid ${c.gray200}`,
  borderRadius: 12,
});
const ChartTitle = styled.span({ ...textStyle.bodyStrong, color: c.gray900 });
const Table = styled.div({
  border: `0.5px solid ${c.gray100}`,
  borderRadius: 12,
  overflow: 'hidden',
});
const Row = styled.div<{ head?: boolean }>(({ head }) => ({
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  alignItems: 'center',
  minHeight: head ? 48 : 56,
  padding: '0 16px',
  background: head ? c.gray100 : c.white,
  ...(head ? textStyle.h3 : textStyle.body),
  '& + &': { borderTop: `0.5px solid ${c.gray100}` },
}));
