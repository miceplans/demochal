'use client';
import { useState } from 'react';
import styled from '@emotion/styled';
import { generated } from '@semochal/api-client';
import { ContestCard } from '@/components/contests/ContestCard';
import { challengeToContest } from '@/components/contests/challenge-to-contest';
import { contestHref } from '@/components/contests/contest-links';
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

const FanSection = styled.section({
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 24,
  [mobile]: { flexDirection: 'column' },
});
const FanTitle = styled.h2({
  ...textStyle.h2,
  margin: 0,
  fontSize: 24,
  fontWeight: 600,
  lineHeight: 1.2,
  letterSpacing: '-0.02em',
  color: c.gray900,
});
// 카드끼리 52px씩 겹치고 오른쪽 카드가 위에 오도록 쌓는다.
const FanCards = styled.div({
  display: 'flex',
  alignItems: 'flex-start',
  [mobile]: { maxWidth: '100%', overflowX: 'auto', padding: '0 0 12px' },
});
const FanItem = styled.div({
  position: 'relative',
  flexShrink: 0,
  width: 249,
  marginRight: -52,
  '&:last-of-type': { marginRight: 0 },
  filter: 'drop-shadow(4px 4px 5px rgb(0 0 0 / 20%))',
  '& article': { border: 0, background: c.gray100 },
  // Figma 썸네일 영역: 249×205.
  '& .artwork': { aspectRatio: 'auto', height: 205 },
  '& .card-body': { background: c.white, borderRadius: '0 0 6px 6px' },
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

/** Figma 01-B(1426:8431): 제목 + 겹쳐 쌓은 공모전 카드 3장. */
export function RecommendedContests() {
  // D-day 계산 기준 시각은 마운트 시 한 번만 잡는다.
  const [now] = useState(() => Date.now());
  const query = generated.useListRecommendedChallenges({ limit: 3 });
  const items = query.data?.status === 200 ? query.data.data.items : [];
  if (items.length === 0) return null;
  return (
    <FanSection>
      <FanTitle>
        합격확률이
        <br />
        높아요!
      </FanTitle>
      <FanCards>
        {items.slice(0, 3).map((challenge) => {
          const contest = challengeToContest(challenge, now);
          return (
            <FanItem key={contest.id}>
              <ContestCard contest={contest} href={contestHref(contest.id)} />
            </FanItem>
          );
        })}
      </FanCards>
    </FanSection>
  );
}
