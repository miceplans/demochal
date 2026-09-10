'use client';
import styled from '@emotion/styled';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import {
  BizContent,
  SectionTitle,
  SectionHeader,
  StatBox,
  StatValue,
  Delta,
  TableBox,
  THead,
  TRow,
  StatusTag,
  BizLink,
} from '@/components/biz/BizShell';
import {
  activeAds,
  chartBars,
  chartMonths,
  payments,
  paymentTotal,
  postingStats,
  recentPosting,
  won,
} from '@/data/biz-design';
import { BizPaymentCard } from '@/components/biz/BizPaymentCard';

const RecentGrid = styled.div({ display: 'flex', alignItems: 'stretch', gap: 16 });
const RecentHeader = styled.div({
  flex: 1,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 24,
  border: `1px solid ${c.gray100}`,
  borderRadius: 12,
  padding: 24,
  minWidth: 0,
});
const Thumb = styled.div({
  width: 159,
  height: 159,
  borderRadius: 15,
  background: c.gray100,
  flexShrink: 0,
});
const Badge = styled.div({ display: 'flex', gap: 9, ...textStyle.finePrint });
const BadgeLabel = styled.strong({ flexShrink: 0 });
const BadgeValue = styled.span({ color: c.gray700 });
const SideStats = styled.div({
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  width: 253,
  flexShrink: 0,
});
const BillingGrid = styled.div({ display: 'flex', alignItems: 'flex-end', gap: 32 });
const ChartBox = styled(StatBox)({ width: 423, flexShrink: 0 });
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
const ChartBar = styled.span<{ h: number }>(({ h }) => ({
  width: '100%',
  height: `${h}%`,
  background: c.primary,
  borderRadius: '4px 4px 0 0',
}));
const Row2 = styled.div({ display: 'flex', gap: 32, alignItems: 'flex-start' });
const AdRow = styled(TRow)({ fontSize: textStyle.subtitle.fontSize });
const EditLink = styled.span({ ...textStyle.metaText, color: c.red });
const Col = ({ w, children }: { w?: number; children: React.ReactNode }) => (
  <span
    style={{
      width: w,
      flexShrink: 0,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }}
  >
    {children}
  </span>
);

export function BizDashboardPage() {
  return (
    <BizContent>
      <section aria-label="나의 가장 최근 공고">
        <SectionTitle style={{ marginBottom: 32 }}>나의 가장 최근 공고</SectionTitle>
        <RecentGrid>
          <RecentHeader>
            <Thumb aria-hidden />
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: 24,
                minWidth: 0,
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <strong style={{ fontSize: 22 }}>{recentPosting.title}</strong>
                <span style={{ color: c.gray700 }}>{recentPosting.org}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Badge>
                  <BadgeLabel>자격 / 대상</BadgeLabel>
                  <BadgeValue>{recentPosting.eligibility}</BadgeValue>
                </Badge>
                <Badge>
                  <BadgeLabel>접수기간</BadgeLabel>
                  <BadgeValue>{recentPosting.period}</BadgeValue>
                </Badge>
              </div>
            </div>
          </RecentHeader>
          <SideStats>
            <StatBox>
              <span style={{ fontSize: 13, color: c.gray700 }}>클릭수</span>
              <StatValue>{postingStats.clicks.value}</StatValue>
              <Delta>{postingStats.clicks.delta}</Delta>
            </StatBox>
            <StatBox>
              <span style={{ fontSize: 13, color: c.gray700 }}>북마크</span>
              <StatValue>{postingStats.bookmarks.value}</StatValue>
              <Delta>{postingStats.bookmarks.delta}</Delta>
            </StatBox>
          </SideStats>
        </RecentGrid>
      </section>
      <section aria-label="나의 결제수단과 결제 내역">
        <BillingGrid>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            <SectionTitle>나의 결제수단</SectionTitle>
            <BizPaymentCard label="총액" amount={`${paymentTotal.toLocaleString()} ₩`} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32, flex: 1, minWidth: 0 }}>
            <SectionHeader>
              <SectionTitle>결제 내역</SectionTitle>
              <BizLink href="/billing" style={{ fontSize: 13, color: c.gray500 }}>
                더보기 →
              </BizLink>
            </SectionHeader>
            <TableBox>
              {payments.map((p) => (
                <TRow key={p.name}>
                  <span
                    style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  >
                    {p.name}
                  </span>
                  <strong style={{ color: p.amount > 0 ? c.green : c.red, flexShrink: 0 }}>
                    {won(p.amount)}
                  </strong>
                </TRow>
              ))}
            </TableBox>
          </div>
        </BillingGrid>
      </section>
      <Row2>
        <ChartBox style={{ height: 347 }}>
          <span style={{ fontSize: 13, color: c.gray700 }}>광고 노출수</span>
          <StatValue>{postingStats.exposure.value}</StatValue>
          <Chart>
            {chartBars.map((h, i) => (
              <ChartCol key={chartMonths[i]}>
                <ChartBar h={h} />
                {chartMonths[i]}
              </ChartCol>
            ))}
          </Chart>
          <Delta>{postingStats.exposure.delta}</Delta>
        </ChartBox>
        <section
          style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}
          aria-label="진행중인 광고"
        >
          <h2 style={{ fontSize: 20, fontWeight: 600 }}>진행중인 광고</h2>
          <TableBox>
            <THead>
              <span style={{ flex: 1 }}>챌린지명</span>
              <Col w={84}>상태</Col>
              <Col w={84}>노출</Col>
              <Col w={84}>북마크</Col>
              <Col w={84}>관리</Col>
            </THead>
            {activeAds.map((ad) => (
              <AdRow key={ad.title}>
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {ad.title}
                </span>
                <Col w={84}>
                  {ad.status === '진행중' ? (
                    <StatusTag tone="green">진행중</StatusTag>
                  ) : (
                    <StatusTag tone="gray">준비중</StatusTag>
                  )}
                </Col>
                <Col w={84}>{ad.exposure}</Col>
                <Col w={84}>{ad.bookmarks}</Col>
                <Col w={84}>
                  <EditLink>편집</EditLink>
                </Col>
              </AdRow>
            ))}
          </TableBox>
        </section>
      </Row2>
    </BizContent>
  );
}
