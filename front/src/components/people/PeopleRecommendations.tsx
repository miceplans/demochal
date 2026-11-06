'use client';
import { useState } from 'react';
import Link from 'next/link';
import styled from '@emotion/styled';
import { generated } from '@semochal/api-client';
import { ContestCard } from '@/components/contests/ContestCard';
import { challengeToContest } from '@/components/contests/challenge-to-contest';
import { contestHref } from '@/components/contests/contest-links';
import { TeamCard } from '@/components/teams/TeamCard';
import { toTeamCard } from '@/components/teams/team-model';
import { colors as c, mobile } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import type { PersonCardModel } from './person';
import { DEFAULT_PROFILE_IMAGE } from './PeopleRecommendations.logic';

const Section = styled.section({ display: 'flex', flexDirection: 'column', gap: 10 });
const Heading = styled.h2({
  ...textStyle.h2,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  margin: 0,
  color: c.gray900,
  '& img': { width: 26, height: 26, objectFit: 'cover', borderRadius: '50%' },
});
const SectionTitleRow = styled.div({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
});
const More = styled(Link)({ ...textStyle.secondaryText, color: c.gray500 });
const PeopleRow = styled.div({
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 165px)',
  gap: 20,
  [mobile]: { gridTemplateColumns: 'repeat(auto-fill, minmax(165px, 1fr))' },
});
const Card = styled.article({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 12,
  padding: 20,
  border: `1px solid ${c.gray100}`,
  borderRadius: 8,
  background: c.white,
  cursor: 'pointer',
  '&:hover, &:focus-within': { boxShadow: '0 4px 12px rgb(0 0 0 / 6%)' },
});
const Avatar = styled.img({
  width: 147,
  height: 147,
  borderRadius: '50%',
  background: c.gray100,
  objectFit: 'cover',
});
const Name = styled.span({ ...textStyle.h1_2, color: c.gray900, wordBreak: 'break-word' });
const Chips = styled.div({ display: 'flex', flexWrap: 'wrap', gap: 4 });
const Badge = styled.span<{ tone: 'gray' | 'blue' }>(({ tone }) => ({
  ...textStyle.finePrint,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  height: 20,
  padding: '0 9px',
  borderRadius: 7.6,
  background: tone === 'blue' ? c.lightBlue : c.gray100,
  color: tone === 'blue' ? c.primary : c.gray900,
  '& img': { width: 11, height: 11 },
}));
const StackChip = styled.span({
  ...textStyle.finePrint,
  display: 'inline-flex',
  alignItems: 'center',
  height: 20,
  padding: '0 10px',
  borderRadius: 15,
  background: c.gray100,
  color: c.gray900,
});
const Grid = styled.div({
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  gap: 20,
  '@media (max-width: 1100px)': { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' },
  [mobile]: { gridTemplateColumns: '1fr' },
});

const HighOddsSection = styled.section({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 24,
  [mobile]: { flexDirection: 'column' },
});
const HighOddsTitle = styled.h2({
  ...textStyle.mHeroHeading,
  margin: 0,
  // Figma 01-B 값(토큰 기본값과 다름)
  lineHeight: 1.2,
  letterSpacing: '-0.02em',
  color: c.gray900,
});
// Figma 01-B(1426:8431): 카드 3장이 52px씩 겹쳐 놓이고 그림자가 드리운다.
const HighOddsCards = styled.div({
  display: 'flex',
  alignItems: 'flex-start',
  paddingRight: 52,
  '& > div': {
    width: 249,
    flexShrink: 0,
    marginRight: -52,
    position: 'relative',
    filter: 'drop-shadow(4px 4px 5px rgb(0 0 0 / 20%))',
    transition: 'transform 0.2s ease, filter 0.2s ease',
    // 호버·키보드 포커스한 카드를 맨 위로 올리고 키우며, 뒤에 그림자를 더 크게 드리운다.
    '&:hover, &:focus-within': {
      zIndex: 1,
      transform: 'scale(1.06)',
      filter: 'drop-shadow(0 12px 24px rgb(0 0 0 / 30%))',
    },
    '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
  },
  [mobile]: { maxWidth: '100%', overflowX: 'auto', paddingBottom: 8 },
});

function RecommendedPersonCard({
  person,
  onSelect,
}: {
  person: PersonCardModel;
  onSelect: (person: PersonCardModel) => void;
}) {
  return (
    <Card
      role="button"
      tabIndex={0}
      aria-label={`${person.name ?? '이름 없음'} 스카우트하기`}
      onClick={() => onSelect(person)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(person);
        }
      }}
    >
      <Avatar src={person.profileImageUrl ?? DEFAULT_PROFILE_IMAGE} alt="" />
      <Name>{person.name ?? '이름 없음'}</Name>
      {(person.hasGithub || person.hasPortfolio) && (
        <Chips>
          {person.hasGithub && (
            <Badge tone="gray">
              <img src="/assets/people/github-badge.svg" alt="" />
              깃허브 인증
            </Badge>
          )}
          {person.hasPortfolio && (
            <Badge tone="blue">
              <img src="/assets/people/portfolio-badge.svg" alt="" />
              포트폴리오
            </Badge>
          )}
        </Chips>
      )}
      {(person.stacks ?? []).length > 0 && (
        <Chips>
          {(person.stacks ?? []).slice(0, 3).map((stack) => (
            <StackChip key={stack}>{stack}</StackChip>
          ))}
        </Chips>
      )}
    </Card>
  );
}

/** 추천 인물 카드를 누르면 스카우트 모달을 연다(부모가 모달을 소유). */
export function RecommendedPeople({ onSelect }: { onSelect: (person: PersonCardModel) => void }) {
  const query = generated.useListRecommendedPeople({ limit: 3 });
  const people = query.data?.status === 200 ? query.data.data : [];
  if (people.length === 0) return null;
  return (
    <Section id="recommended-people" style={{ scrollMarginTop: 80 }}>
      <Heading>
        <img src="/assets/people/recommend-icon.png" alt="" />
        나와 맞는 사람 찾기
      </Heading>
      <PeopleRow>
        {people.map((person) => (
          <RecommendedPersonCard key={person.id} person={person} onSelect={onSelect} />
        ))}
      </PeopleRow>
    </Section>
  );
}

export function RecommendedContests() {
  // D-day 계산 기준 시각은 마운트 시 한 번만 잡는다.
  const [now] = useState(() => Date.now());
  const query = generated.useListRecommendedChallenges({ limit: 4 });
  const items = query.data?.status === 200 ? query.data.data.items : [];
  if (items.length === 0) return null;
  return (
    <Section>
      <SectionTitleRow>
        <Heading>공모전 추천</Heading>
        <More href="/explore">더보기 →</More>
      </SectionTitleRow>
      <Grid>
        {items.map((challenge) => {
          const contest = challengeToContest(challenge, now);
          return <ContestCard key={contest.id} contest={contest} href={contestHref(contest.id)} />;
        })}
      </Grid>
    </Section>
  );
}

export function RecommendedTeams() {
  const query = generated.useListRecommendedTeams({ limit: 4 });
  const teams = query.data?.status === 200 ? query.data.data : [];
  if (teams.length === 0) return null;
  return (
    <Section>
      <SectionTitleRow>
        <Heading>팀 추천</Heading>
        <More href="/teams">더보기 →</More>
      </SectionTitleRow>
      <Grid>
        {teams.map((team) => (
          <TeamCard key={team.id} team={toTeamCard(team)} />
        ))}
      </Grid>
    </Section>
  );
}

/** "나와 맞는 사람 찾기" 아래에 붙는 합격확률 높은 공모전 3장(Figma 01-B 1426:8431). */
export function RecommendedHighOdds() {
  // D-day 계산 기준 시각은 마운트 시 한 번만 잡는다.
  const [now] = useState(() => Date.now());
  // RecommendedContests와 같은 파라미터(limit 4)로 호출해 TanStack Query 캐시를 공유한다(요청 1회).
  const query = generated.useListRecommendedChallenges({ limit: 4 });
  const items = query.data?.status === 200 ? query.data.data.items : [];
  if (items.length === 0) return null;
  return (
    <HighOddsSection aria-labelledby="high-odds-title">
      <HighOddsTitle id="high-odds-title">
        합격확률이
        <br />
        높아요!
      </HighOddsTitle>
      <HighOddsCards>
        {items.slice(0, 3).map((challenge) => {
          const contest = challengeToContest(challenge, now);
          return (
            <div key={contest.id}>
              <ContestCard contest={contest} href={contestHref(contest.id)} />
            </div>
          );
        })}
      </HighOddsCards>
    </HighOddsSection>
  );
}
