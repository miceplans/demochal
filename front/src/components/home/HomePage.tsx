'use client';
import Link from 'next/link';
import styled from '@emotion/styled';
import { UserShell } from '@/components/common/UserShell';
import {
  SectionHeader,
  Select,
  Row,
  DesktopOnly,
  MobileOnly,
  asset,
} from '@/components/common/Primitives';
import { ContestCard } from '@/components/contests/ContestCard';
import { TeamCard } from '@/components/teams/TeamCard';
import { desktopContests, teams } from '@/data/user-design';
import { mobile, colors as c } from '@/styles/design';

const Home = styled.div({ padding: '60px 0', overflow: 'hidden', [mobile]: { padding: 0 } });
const HeroRail = styled.div({
  display: 'flex',
  justifyContent: 'center',
  gap: 60,
  height: 252,
  marginBottom: 60,
  '& img': { width: 1059, height: 252, borderRadius: 12, objectFit: 'cover', flexShrink: 0 },
  [mobile]: { display: 'none' },
});
const MobileHero = styled(Link)({
  display: 'none',
  [mobile]: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
    height: 148,
    padding: 20,
    background: c.lightBlue,
    borderRadius: 8,
    '& h2': { fontSize: 18 },
    '& p': { fontSize: 12, color: c.gray700 },
  },
});
const Sections = styled.div({
  maxWidth: 1200,
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 60,
  [mobile]: { gap: 32, padding: '24px 16px' },
});
const Rail = styled.div({
  display: 'flex',
  gap: 16,
  overflowX: 'auto',
  scrollbarWidth: 'none',
  '& > article': { flex: '0 0 416px' },
  [mobile]: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 8,
    '& > article': { flex: 'none' },
  },
});
const TeamRail = styled.div({
  display: 'flex',
  gap: 16,
  overflowX: 'auto',
  scrollbarWidth: 'none',
  '& > article': { flex: '0 0 362px' },
  [mobile]: { flexDirection: 'column', gap: 12, '& > article': { flex: 'none' } },
});
const PhotoRail = styled.div({
  display: 'flex',
  gap: 32,
  justifyContent: 'center',
  margin: '60px 0',
  '& img': { width: 315, height: 190, borderRadius: 8, objectFit: 'cover' },
  [mobile]: {
    gap: 12,
    margin: '8px 0 32px',
    justifyContent: 'flex-start',
    overflow: 'hidden',
    padding: '0 16px',
    '& img': { width: 122, height: 74 },
  },
});
const More = styled(Link)({ fontSize: 13, color: c.gray500 });
export function HomePage() {
  return (
    <UserShell>
      <Home>
        <HeroRail>
          {[0, 1, 2].map((i) => (
            <img
              key={i}
              src={asset('195-959', 'imgHero')}
              width={1059}
              height={252}
              alt="PIZZA FLEX"
            />
          ))}
        </HeroRail>
        <MobileHero href="/my/interests">
          <h2>나에게 맞는 챌린지 찾기</h2>
          <p>관심분야 등록하고 맞춤 추천 받아보세요</p>
        </MobileHero>
        <Sections>
          <section>
            <DesktopOnly style={{ marginBottom: 28 }}>
              <Row>
                <Select aria-label="분야">
                  <option>분야</option>
                  <option>IT/SW</option>
                  <option>디자인</option>
                </Select>
                <Select aria-label="연도">
                  <option>2025년</option>
                  <option>2024년</option>
                </Select>
                <Select aria-label="수상등급">
                  <option>수상등급</option>
                  <option>대상</option>
                  <option>우수상</option>
                </Select>
              </Row>
            </DesktopOnly>
            <SectionHeader
              title="지영님에게 맞는 AI 추천"
              action={
                <DesktopOnly>
                  <More href="/explore">더보기 →</More>
                </DesktopOnly>
              }
            />
            <div style={{ height: 16 }} />
            <DesktopOnly>
              <Rail>
                {desktopContests.slice(0, 4).map((contest) => (
                  <ContestCard key={contest.id} contest={contest} />
                ))}
              </Rail>
            </DesktopOnly>
            <MobileOnly>
              <Rail>
                {desktopContests.slice(0, 2).map((contest) => (
                  <ContestCard key={contest.id} contest={contest} simple />
                ))}
              </Rail>
            </MobileOnly>
          </section>
          <section>
            <DesktopOnly>
              <SectionHeader title="마감임박 D-7" action={<More href="/explore">더보기 →</More>} />
              <div style={{ height: 16 }} />
              <Rail>
                {desktopContests.slice(0, 4).map((contest) => (
                  <ContestCard key={contest.id} contest={contest} />
                ))}
              </Rail>
            </DesktopOnly>
            <MobileOnly>
              <SectionHeader title="마감임박! 지금 해야하는 챌린지" />
              <div style={{ display: 'grid', gap: 24, marginTop: 20 }}>
                {desktopContests.slice(0, 4).map((contest) => (
                  <ContestCard key={contest.id} contest={contest} horizontal />
                ))}
              </div>
            </MobileOnly>
          </section>
        </Sections>
        <PhotoRail>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <img
              key={i}
              src={asset('195-959', 'imgImage11')}
              alt="공모전 행사 현장"
              width={315}
              height={190}
            />
          ))}
        </PhotoRail>
        <Sections>
          <section>
            <MobileOnly style={{ marginBottom: 16 }}>
              <SectionHeader title="팀원모집중" action={<More href="/teams">더보기 ›</More>} />
            </MobileOnly>
            <DesktopOnly>
              <TeamRail>
                {teams.map((team) => (
                  <TeamCard key={team.id} />
                ))}
              </TeamRail>
            </DesktopOnly>
            <MobileOnly>
              <TeamRail>
                {teams.slice(0, 3).map((team) => (
                  <TeamCard key={team.id} team={team} />
                ))}
              </TeamRail>
            </MobileOnly>
          </section>
        </Sections>
      </Home>
    </UserShell>
  );
}
