'use client';

import { generated } from '@semochal/api-client';
import styled from '@emotion/styled';
import { siteHref } from '@/lib/biz';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { ExposureChart } from '@/components/biz/ExposureChart';
import {
  BizContent,
  BizLink,
  PrimaryButton,
  SectionHeader,
  SectionTitle,
  StatBox,
  useBizHref,
} from '@/components/biz/BizShell';
import { Icon } from '@/components/common/Primitives';

const formatDate = (iso: string) => iso.slice(0, 10).replaceAll('-', '.');
const daysLeft = (endDate: string) =>
  Math.ceil((new Date(endDate).getTime() - Date.now()) / 86_400_000);

export function BizPostingsPage() {
  const hrefOf = useBizHref();
  const challengesQuery = generated.useListMyChallenges();
  const page = challengesQuery.data?.status === 200 ? challengesQuery.data.data : undefined;
  const items = page?.items ?? [];
  const loading = challengesQuery.isPending;
  const error = challengesQuery.isError;
  const latest = items[0];
  const statsQuery = generated.useGetMyChallengeStats(latest?.id ?? '', {
    query: { enabled: !!latest },
  });
  const stats = statsQuery.data?.status === 200 ? statsQuery.data.data : undefined;
  const distribution = stats?.applicantDistribution ?? [];
  const primaryShare = distribution[0]?.value ?? 0;
  return (
    <BizContent>
      {loading && <Message>공고를 불러오는 중입니다.</Message>}
      {error && <Message>공고를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</Message>}
      {!loading && !error && !latest && (
        <>
          <Message>등록된 공고가 없습니다.</Message>
          <PrimaryButton
            style={{ alignSelf: 'center' }}
            onClick={() => (window.location.href = hrefOf('/postings/new'))}
          >
            챌린지 추가
          </PrimaryButton>
        </>
      )}
      {latest && (
        <>
          <section aria-label="공고 성과 요약">
            <HeaderRow>
              <Thumb aria-hidden />
              <HeaderInfo>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <PostingTitle>{latest.title}</PostingTitle>
                    <PostingOrg>{latest.organizer}</PostingOrg>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <Badge>
                      <BadgeLabel>자격 / 대상</BadgeLabel>
                      <BadgeValue>{latest.eligibility}</BadgeValue>
                    </Badge>
                    <Badge>
                      <BadgeLabel>접수기간</BadgeLabel>
                      <BadgeValue>
                        {formatDate(latest.startDate)} ~ {formatDate(latest.endDate)}
                      </BadgeValue>
                    </Badge>
                  </div>
                </div>
                <ActionRow>
                  <EditLink href={`/postings/${latest.id}`}>공고 수정</EditLink>
                  <ViewLink href={siteHref(`/contests/${latest.id}`)}>자세히 보기</ViewLink>
                </ActionRow>
              </HeaderInfo>
            </HeaderRow>
          </section>

          <StatsRow>
            <PieBox>
              <span style={textStyle.h3_2}>지원자 분포</span>
              <PieRow>
                <PieCircle pct={primaryShare} aria-hidden />
                <Legend>
                  {distribution.map((d, i) => (
                    <LegendRow key={d.label}>
                      <Dot tone={i === 0 ? 'primary' : 'light'} aria-hidden />
                      {d.label}
                      <LegendValue>{d.value}%</LegendValue>
                    </LegendRow>
                  ))}
                </Legend>
              </PieRow>
            </PieBox>
            <ExposureBox>
              <span style={{ fontSize: 13, color: c.gray700 }}>공고 노출수</span>
              <strong style={{ fontSize: 22, color: c.gray900 }}>
                {(stats?.exposure?.value ?? 0).toLocaleString()} 조회수
              </strong>
              <ExposureChart bars={stats?.monthlyExposure ?? []} />
              <span style={{ ...textStyle.finePrint, color: c.green }}>
                {(stats?.exposure?.deltaPercent ?? 0) >= 0 ? '+' : ''}
                {stats?.exposure?.deltaPercent ?? 0}% 전주 대비
              </span>
            </ExposureBox>
          </StatsRow>

          <section aria-label="내가 게시했던 공고">
            <SectionHeader style={{ marginBottom: 28 }}>
              <SectionTitle>내가 게시했던 공고</SectionTitle>
              <PrimaryButton onClick={() => (window.location.href = hrefOf('/postings/new'))}>
                챌린지 추가
              </PrimaryButton>
            </SectionHeader>
            <PostingsGrid>
              {items.map((item) => {
                const left = daysLeft(item.endDate);
                const closed = left < 0;
                return (
                  <CardBox key={item.id} href={`/postings/${item.id}`}>
                    <CardThumb closed={closed}>
                      {closed && <CardClosedLabel>마감된 공고입니다.</CardClosedLabel>}
                    </CardThumb>
                    <CardBody>
                      <CardTitle>{item.title}</CardTitle>
                      <CardMeta>
                        <CategoryTag>{item.category ?? '미분류'}</CategoryTag>
                        {!closed && <Dday>{left === 0 ? 'D-DAY' : `D-${left}`}</Dday>}
                      </CardMeta>
                      <CardBottom>
                        <Icon src="/assets/icons/scrap.png" size={16} alt="북마크" />
                      </CardBottom>
                    </CardBody>
                  </CardBox>
                );
              })}
            </PostingsGrid>
          </section>
        </>
      )}
    </BizContent>
  );
}

const Message = styled.p({ color: c.gray500, padding: '48px 0', textAlign: 'center' });
const HeaderRow = styled.div({
  display: 'flex',
  gap: 24,
  alignItems: 'stretch',
  width: '100%',
});
const Thumb = styled.div({
  flex: '1 0 0',
  minWidth: 0,
  minHeight: 354,
  borderRadius: 18,
  background: c.gray100,
});
const HeaderInfo = styled.div({
  flex: '1 0 0',
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  gap: 24,
  padding: '20px 0',
});
const PostingTitle = styled.strong({ fontSize: 22, color: c.gray900 });
const PostingOrg = styled.span({ color: c.gray700, fontSize: 15 });
const Badge = styled.div({ display: 'flex', gap: 9, ...textStyle.finePrint });
const BadgeLabel = styled.strong({ flexShrink: 0, color: c.gray900 });
const BadgeValue = styled.span({ color: c.gray700 });
const ActionRow = styled.div({ display: 'flex', gap: 9, width: '100%' });
const EditLink = styled(BizLink)({
  flex: 1,
  height: 37,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: `1px solid ${c.gray500}`,
  borderRadius: 6,
  background: c.white,
  color: c.gray900,
  ...textStyle.overline,
});
const ViewLink = styled.a({
  flex: 1,
  height: 37,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: 0,
  borderRadius: 6,
  background: c.primary,
  color: c.white,
  ...textStyle.subtitle,
});

const StatsRow = styled.div({ display: 'flex', gap: 24, alignItems: 'stretch', flexWrap: 'wrap' });
const PieBox = styled(StatBox)({ width: 386, flexShrink: 0, borderRadius: 20, gap: 20 });
const PieRow = styled.div({ display: 'flex', alignItems: 'center', gap: 32 });
const PieCircle = styled.div<{ pct: number }>(({ pct }) => ({
  width: 144,
  height: 144,
  borderRadius: '50%',
  flexShrink: 0,
  background: `conic-gradient(${c.primary} 0% ${pct}%, ${c.lightBlue} ${pct}% 100%)`,
}));
const Legend = styled.div({ display: 'flex', flexDirection: 'column', gap: 10 });
const LegendRow = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  ...textStyle.bodySmall,
});
const Dot = styled.span<{ tone: 'primary' | 'light' }>(({ tone }) => ({
  width: 8,
  height: 8,
  borderRadius: '50%',
  flexShrink: 0,
  background: tone === 'primary' ? c.primary : c.lightBlue,
}));
const LegendValue = styled.strong({ marginLeft: 'auto', color: c.primary, ...textStyle.h3 });

const ExposureBox = styled(StatBox)({ width: 297, flexShrink: 0, justifyContent: 'flex-start' });

const PostingsGrid = styled.div({ display: 'flex', gap: 16, flexWrap: 'wrap' });
const CardBox = styled(BizLink)({
  width: 416,
  flexShrink: 0,
  borderRadius: 12,
  overflow: 'hidden',
  background: c.gray100,
  display: 'block',
});
const CardThumb = styled.div<{ closed?: boolean }>(({ closed }) => ({
  position: 'relative',
  height: 189,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: c.gray100,
  ...(closed
    ? {
        '&::after': {
          content: '""',
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.1)',
        },
      }
    : {}),
}));
const CardClosedLabel = styled.span({
  position: 'relative',
  zIndex: 1,
  ...textStyle.h3_2,
  color: c.white,
});
const CardBody = styled.div({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: 14,
  background: c.gray100,
});
const CardTitle = styled.p({ margin: 0, ...textStyle.h3_2, color: c.gray900 });
const CardMeta = styled.div({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
});
const CategoryTag = styled.span({
  background: c.gray200,
  color: c.gray700,
  borderRadius: 4,
  padding: '3px 8px',
  ...textStyle.finePrint,
});
const Dday = styled.span({ color: c.primary, ...textStyle.overline });
const CardBottom = styled.div({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
});
