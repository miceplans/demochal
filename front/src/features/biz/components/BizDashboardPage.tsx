'use client';

import styled from '@emotion/styled';
import { generated } from '@semochal/api-client';
import { BizPaymentCard } from '@/components/biz/BizPaymentCard';
import { ExposureChart } from '@/components/biz/ExposureChart';
import {
  BizContent,
  BizLink,
  SectionHeader,
  SectionTitle,
  StatusTag,
} from '@/components/biz/BizShell';
import { won } from '@/data/biz-design';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';

const formatDate = (iso?: string) => (iso ? iso.slice(0, 10).replaceAll('-', '.') : '');
const formatDelta = (stat?: { deltaPercent?: number }) => {
  const pct = stat?.deltaPercent ?? 0;
  return { text: `${pct >= 0 ? '+' : ''}${pct}% 전주 대비`, negative: pct < 0 };
};

const RecentRow = styled.div({ display: 'flex', alignItems: 'flex-end', gap: 16 });
const RecentMain = styled.div({
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 32,
});
const ContestHeader = styled.div({
  height: 354,
  display: 'flex',
  flexDirection: 'column',
  gap: 24,
});
const Thumbnail = styled.div({ flex: 1, minHeight: 0, borderRadius: 19, background: c.gray100 });
const HeaderInfo = styled.div({ display: 'flex', justifyContent: 'space-between', gap: 24 });
const HeaderTitle = styled.div({ display: 'flex', flexDirection: 'column', gap: 10 });
const PostingTitle = styled.strong({ fontSize: 22, fontWeight: 700, color: c.gray900 });
const PostingOrg = styled.span({ ...textStyle.body, color: c.gray700 });
const Facts = styled.div({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  ...textStyle.finePrint,
});
const Fact = styled.div({ display: 'flex', alignItems: 'center', gap: 9 });
const FactLabel = styled.strong({ fontWeight: 600, color: c.gray900, whiteSpace: 'nowrap' });
const FactValue = styled.span({ color: c.gray700 });

const SideStats = styled.div({
  width: 253,
  height: 347,
  flexShrink: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
});
const Stat = styled.div<{ bordered?: boolean }>(({ bordered }) => ({
  flex: 1,
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: 20,
  borderRadius: 12,
  background: c.white,
  border: bordered ? `0.5px solid ${c.gray200}` : 0,
}));
const StatLabel = styled.span({ ...textStyle.caption, color: c.gray700 });
const StatNumber = styled.strong({ fontSize: 28, fontWeight: 700, color: c.gray900 });
const DeltaText = styled.span<{ negative?: boolean }>(({ negative }) => ({
  ...textStyle.metaText,
  color: negative ? c.red : c.green,
}));

const BillingRow = styled.div({ display: 'flex', alignItems: 'flex-end', gap: 32 });
const Column = styled.div({ display: 'flex', flexDirection: 'column', gap: 32 });
const MoreLink = styled(BizLink)({ ...textStyle.caption, color: c.gray500 });
const PaymentList = styled.ul({
  margin: 0,
  padding: 0,
  listStyle: 'none',
  border: `1px solid ${c.gray200}`,
  borderRadius: 12,
  overflow: 'hidden',
  ...textStyle.bodyLarge,
});
const PaymentItem = styled.li({
  height: 56,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
  padding: '0 16px',
  background: c.white,
  '& + &': { borderTop: `1px solid ${c.gray200}` },
});
const Ellipsis = styled.span({
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});
const EmptyText = styled.p({ margin: 0, padding: 16, ...textStyle.caption, color: c.gray500 });
const CardEmpty = styled.div({
  width: 350,
  height: 224,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 25,
  background: c.gray100,
  ...textStyle.caption,
  color: c.gray500,
});

const AdsRow = styled.div({ display: 'flex', alignItems: 'flex-start', gap: 32 });
const ChartCard = styled.div({
  width: 423,
  height: 347,
  flexShrink: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: 20,
  border: `0.5px solid ${c.gray200}`,
  borderRadius: 12,
});
const AdsSection = styled.section({
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
});
const AdsTitle = styled.h2({ margin: 0, ...textStyle.h1_2 });
const AdsTable = styled.div({
  border: `0.5px solid ${c.gray100}`,
  borderRadius: 12,
  overflow: 'hidden',
});
const AdsHead = styled.div({
  display: 'flex',
  alignItems: 'center',
  padding: 16,
  background: c.gray100,
  ...textStyle.h3,
});
const AdsBody = styled.div({
  display: 'flex',
  alignItems: 'center',
  padding: '14px 16px',
  borderBottom: `0.5px solid ${c.gray100}`,
  ...textStyle.caption,
});
const AdName = styled.span({
  flex: 1,
  minWidth: 0,
  ...textStyle.subtitle,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});
const AdCol = styled.span<{ w: number }>(({ w }) => ({ width: w, flexShrink: 0 }));
const EditText = styled.span({ ...textStyle.metaText, color: c.red });

function AdStatusTag({ status }: { status?: string }) {
  return status === 'active' ? (
    <StatusTag tone="green">진행중</StatusTag>
  ) : (
    <StatusTag tone="gray">{status === 'preparing' ? '준비중' : '종료'}</StatusTag>
  );
}

export function BizDashboardPage() {
  const dashboardQuery = generated.useGetBizDashboard();
  const cardsQuery = generated.useListPaymentCards();
  const data = dashboardQuery.data?.data;
  const card = cardsQuery.data?.data[0];

  if (dashboardQuery.isError)
    return (
      <BizContent>
        <p>대시보드 데이터를 불러오지 못했습니다.</p>
      </BizContent>
    );
  if (!data)
    return (
      <BizContent>
        <p>대시보드를 불러오는 중입니다.</p>
      </BizContent>
    );

  const posting = data.recentPosting;
  const clicks = formatDelta(data.stats?.clicks);
  const bookmarks = formatDelta(data.stats?.bookmarks);
  const exposure = formatDelta(data.stats?.exposure);
  const payments = data.payments ?? [];
  const activeAds = data.activeAds ?? [];

  return (
    <BizContent style={{ gap: 32 }}>
      <RecentRow>
        <RecentMain>
          <SectionTitle>나의 가장 최근 공고</SectionTitle>
          <ContestHeader>
            <Thumbnail aria-hidden />
            {posting ? (
              <HeaderInfo>
                <HeaderTitle>
                  <PostingTitle>{posting.title}</PostingTitle>
                  <PostingOrg>{posting.organizer}</PostingOrg>
                </HeaderTitle>
                <Facts>
                  <Fact>
                    <FactLabel>자격 / 대상</FactLabel>
                    <FactValue>{posting.eligibility}</FactValue>
                  </Fact>
                  <Fact>
                    <FactLabel>접수기간</FactLabel>
                    <FactValue>
                      {formatDate(posting.startDate)} ~ {formatDate(posting.endDate)}
                    </FactValue>
                  </Fact>
                </Facts>
              </HeaderInfo>
            ) : (
              <PostingOrg>등록된 공고가 없어요.</PostingOrg>
            )}
          </ContestHeader>
        </RecentMain>
        <SideStats>
          <Stat>
            <StatLabel>클릭수</StatLabel>
            <StatNumber>{(data.stats?.clicks?.value ?? 0).toLocaleString()}번</StatNumber>
            <DeltaText negative={clicks.negative}>{clicks.text}</DeltaText>
          </Stat>
          <Stat bordered>
            <StatLabel>북마크</StatLabel>
            <StatNumber>{(data.stats?.bookmarks?.value ?? 0).toLocaleString()}개</StatNumber>
            <DeltaText negative={bookmarks.negative}>{bookmarks.text}</DeltaText>
          </Stat>
        </SideStats>
      </RecentRow>

      <BillingRow>
        <Column>
          <SectionTitle>나의 결제수단</SectionTitle>
          {card ? (
            <BizPaymentCard
              label="금액"
              amount={`${(data.paymentTotal ?? 0).toLocaleString()} ₩`}
              maskedNumber={card.maskedNumber}
              cardName={card.cardName}
            />
          ) : (
            <CardEmpty>등록된 결제수단이 없어요.</CardEmpty>
          )}
        </Column>
        <Column style={{ flex: 1, minWidth: 0 }}>
          <SectionHeader>
            <SectionTitle>결제 내역</SectionTitle>
            <MoreLink href="/billing">더보기 →</MoreLink>
          </SectionHeader>
          <PaymentList>
            {payments.map((p) => (
              <PaymentItem key={p.id}>
                <Ellipsis>{p.name}</Ellipsis>
                <span style={{ flexShrink: 0, color: p.amount > 0 ? c.green : c.red }}>
                  {won(p.amount)}
                </span>
              </PaymentItem>
            ))}
            {payments.length === 0 && <EmptyText>결제 내역이 없어요.</EmptyText>}
          </PaymentList>
        </Column>
      </BillingRow>

      <AdsRow>
        <ChartCard>
          <StatLabel>광고 노출수</StatLabel>
          <StatNumber>{(data.stats?.exposure?.value ?? 0).toLocaleString()} 조회수</StatNumber>
          <ExposureChart bars={data.monthlyAdExposure ?? []} />
          <DeltaText negative={exposure.negative}>{exposure.text}</DeltaText>
        </ChartCard>
        <AdsSection aria-label="진행중인 광고">
          <AdsTitle>진행중인 광고</AdsTitle>
          <AdsTable>
            <AdsHead>
              <span style={{ flex: 1 }}>챌린지명</span>
              <AdCol w={84}>상태</AdCol>
              <AdCol w={84}>노출</AdCol>
              <AdCol w={84}>북마크</AdCol>
              <AdCol w={84}>관리</AdCol>
            </AdsHead>
            {activeAds.map((ad) => (
              <AdsBody key={ad.id}>
                <AdName>{ad.title}</AdName>
                <AdCol w={84}>
                  <AdStatusTag status={ad.status} />
                </AdCol>
                <AdCol w={84}>{ad.impressions?.toLocaleString() ?? '—'}</AdCol>
                <AdCol w={84}>{ad.bookmarks?.toLocaleString() ?? '—'}</AdCol>
                <AdCol w={84}>
                  <BizLink href="/ads">
                    <EditText>편집</EditText>
                  </BizLink>
                </AdCol>
              </AdsBody>
            ))}
            {activeAds.length === 0 && <EmptyText>진행중인 광고가 없어요.</EmptyText>}
          </AdsTable>
        </AdsSection>
      </AdsRow>
    </BizContent>
  );
}
