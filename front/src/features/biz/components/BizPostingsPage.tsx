'use client';
import { useRouter } from 'next/navigation';
import styled from '@emotion/styled';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { siteHref } from '@/lib/biz';
import {
  BizContent,
  SectionHeader,
  SectionTitle,
  PrimaryButton,
  StatBox,
  BizLink,
  useBizHref,
} from '@/components/biz/BizShell';
import { Icon } from '@/components/common/Primitives';
import {
  applicantDistribution,
  chartMonths,
  myPostingCards,
  postingStats,
  recentPosting,
} from '@/data/biz-design';

const HeaderRow = styled.div({
  display: 'flex',
  gap: 24,
  alignItems: 'stretch',
  width: '100%',
});
const Thumb = styled.div({
  flex: '1 0 0',
  minWidth: 0,
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
const PieBox = styled(StatBox)({ width: 340, flexShrink: 0, borderRadius: 20, gap: 20 });
const PieRow = styled.div({ display: 'flex', alignItems: 'center', gap: 32 });
const PieCircle = styled.div<{ pct: number }>(({ pct }) => ({
  width: 130,
  height: 130,
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

const ExposureBox = styled(StatBox)({ width: 300, flexShrink: 0, justifyContent: 'flex-start' });
const ExposureChart = styled.svg({ width: '100%', height: 110, marginTop: 8 });

const PostingsGrid = styled.div({ display: 'flex', gap: 16, flexWrap: 'wrap' });
const CardBox = styled(BizLink)({
  width: 340,
  flexShrink: 0,
  borderRadius: 12,
  overflow: 'hidden',
  background: c.gray100,
  display: 'block',
});
const CardThumb = styled.div<{ closed?: boolean }>(({ closed }) => ({
  position: 'relative',
  height: 180,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
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
  color: c.gray100,
});
const CardBody = styled.div({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: 14,
  background: c.white,
  borderRadius: '0 0 6px 6px',
});
const CardTitle = styled.p({ ...textStyle.h3_2, color: c.gray900 });
const CardMeta = styled.div({ display: 'flex', alignItems: 'center', justifyContent: 'space-between' });
const CategoryTag = styled.span({
  background: c.gray100,
  color: c.gray700,
  borderRadius: 4,
  padding: '3px 8px',
  ...textStyle.finePrint,
});
const Dday = styled.span({ color: c.primary, ...textStyle.overline });
const CardBottom = styled.div({ display: 'flex', alignItems: 'center', justifyContent: 'space-between' });
const TeamBadge = styled.span({
  background: c.lightBlue,
  color: c.primary,
  borderRadius: 4,
  padding: '4px 8px',
  ...textStyle.finePrint,
});

function exposureAreaPath(width: number, height: number) {
  const points = [0.55, 0.3, 0.5, 0.65, 0.35, 0.55, 0.2, 0.45, 0.7, 0.4].map((v, i, arr) => {
    const x = (i / (arr.length - 1)) * width;
    const y = height - v * height;
    return [x, y] as const;
  });
  const line = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${width},${height} L0,${height} Z`;
  return { line, area };
}

export function BizPostingsPage() {
  const router = useRouter();
  const hrefOf = useBizHref();
  const { line, area } = exposureAreaPath(280, 100);

  return (
    <BizContent>
      <section aria-label="공고 성과 요약">
        <HeaderRow>
          <Thumb aria-hidden />
          <HeaderInfo>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <strong style={{ fontSize: 22, color: c.gray900 }}>{recentPosting.title}</strong>
                <span style={{ color: c.gray700, fontSize: 15 }}>{recentPosting.org}</span>
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
            <ActionRow>
              <EditLink href={`/postings/${recentPosting.id}`}>공고 수정</EditLink>
              <ViewLink href={siteHref('/contests/public-data')}>자세히 보기</ViewLink>
            </ActionRow>
          </HeaderInfo>
        </HeaderRow>
      </section>

      <StatsRow>
        <PieBox>
          <span style={textStyle.h3_2}>지원자 분포</span>
          <PieRow>
            <PieCircle pct={applicantDistribution[0].value} aria-hidden />
            <Legend>
              {applicantDistribution.map((d, i) => (
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
          <strong style={{ fontSize: 22, color: c.gray900 }}>{postingStats.exposure.value}</strong>
          <ExposureChart viewBox="0 0 280 100" preserveAspectRatio="none" aria-hidden>
            <defs>
              <linearGradient id="exposureFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={c.primary} stopOpacity={0.25} />
                <stop offset="100%" stopColor={c.primary} stopOpacity={0} />
              </linearGradient>
            </defs>
            <path d={area} fill="url(#exposureFill)" />
            <path d={line} fill="none" stroke={c.primary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </ExposureChart>
          <div style={{ display: 'flex', justifyContent: 'space-between', ...textStyle.finePrint, color: c.gray300 }}>
            {chartMonths.map((m) => (
              <span key={m}>{m}</span>
            ))}
          </div>
          <span style={{ ...textStyle.finePrint, color: c.green }}>{postingStats.exposure.delta}</span>
        </ExposureBox>
      </StatsRow>

      <section aria-label="내가 게시했던 공고">
        <SectionHeader style={{ marginBottom: 28 }}>
          <SectionTitle>내가 게시했던 공고</SectionTitle>
          <PrimaryButton onClick={() => router.push(hrefOf('/postings/new'))}>
            챌린지 추가
          </PrimaryButton>
        </SectionHeader>
        <PostingsGrid>
          {myPostingCards.map((card) => (
            <CardBox key={card.id} href={`/postings/${card.id}`}>
              <CardThumb closed={card.closed}>
                {card.closed && <CardClosedLabel>마감된 공고입니다.</CardClosedLabel>}
              </CardThumb>
              <CardBody>
                <CardTitle>{card.title}</CardTitle>
                <CardMeta>
                  <CategoryTag>{card.category}</CategoryTag>
                  <Dday>{card.dday}</Dday>
                </CardMeta>
                <CardBottom>
                  <Icon src="/assets/icons/scrap.png" size={16} alt="북마크" />
                  <TeamBadge>팀 모집 {card.teamCount}건</TeamBadge>
                </CardBottom>
              </CardBody>
            </CardBox>
          ))}
        </PostingsGrid>
      </section>
    </BizContent>
  );
}
