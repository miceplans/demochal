import Link from 'next/link';
import Image from 'next/image';
import styled from '@emotion/styled';
import { colors as c, mobile } from '@/styles/design';

// Figma 1331:22665 — 사람찾기 목록 상단 배너 2개(팀원 추천 / 공모전 추천).
// 배너 배경색은 이미지 소재에 맞춘 값이라 디자인 토큰에 없다.
const TEAM_BG = 'linear-gradient(to top, #e7f5ff, #bbd8ff)';
const CONTEST_BG = '#001741';

const Row = styled.div({
  display: 'flex',
  gap: 12,
  height: 242,
  '@media (max-width: 900px)': { height: 'auto', flexDirection: 'column' },
});
const Banner = styled.div({
  position: 'relative',
  overflow: 'hidden',
  height: 242,
  borderRadius: 8,
});
const TeamBanner = styled(Banner)({
  flex: '861 1 0',
  minWidth: 0,
  background: TEAM_BG,
  [mobile]: { height: 200 },
});
const ContestBanner = styled(Banner.withComponent(Link))({
  display: 'block',
  flex: '327 1 0',
  minWidth: 0,
  background: CONTEST_BG,
  color: c.white,
  textDecoration: 'none',
  '@media (max-width: 900px)': { flex: 'none' },
});
const Layer = styled.div({ position: 'absolute', pointerEvents: 'none' });

const TeamTitle = styled.p({
  position: 'absolute',
  left: 26,
  top: 33,
  margin: 0,
  fontSize: 32,
  fontWeight: 700,
  lineHeight: 'normal',
  color: '#000',
  [mobile]: { left: 20, top: 24, fontSize: 22 },
});
const UseButton = styled(Link)({
  position: 'absolute',
  left: 26,
  bottom: 24,
  padding: 10,
  borderRadius: 8,
  background: c.primary,
  color: c.white,
  fontSize: 14,
  fontWeight: 600,
  lineHeight: 'normal',
  textDecoration: 'none',
  '&:hover': { background: '#005ee0' },
  [mobile]: { left: 20, bottom: 16 },
});

const ContestTitle = styled.p({
  position: 'absolute',
  right: 23,
  top: 17.5,
  margin: 0,
  fontSize: 24,
  fontWeight: 700,
  lineHeight: 'normal',
  textAlign: 'right',
  color: c.white,
});
const Fade = styled.div({
  position: 'absolute',
  left: 0,
  right: 0,
  bottom: 0,
  height: 134,
  background: `linear-gradient(to bottom, rgba(0, 23, 65, 0.12), ${CONTEST_BG} 93%)`,
  pointerEvents: 'none',
});
const CardGroup = styled.div({
  position: 'absolute',
  top: 116.5,
  left: '50%',
  width: 280,
  height: 140,
  marginLeft: -140,
});
const MiniCard = styled.div<{ x: number; y: number; rotate?: number }>(({ x, y, rotate = 0 }) => ({
  position: 'absolute',
  left: x,
  top: y,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'flex-end',
  width: 90.4,
  height: 91,
  borderRadius: 3.8,
  background: c.gray100,
  transform: `rotate(${rotate}deg)`,
  '& > div': {
    display: 'flex',
    flexDirection: 'column',
    gap: 2.5,
    padding: 4.4,
    borderRadius: '0 0 1.9px 1.9px',
    background: c.white,
  },
  '& p': { margin: 0, fontSize: 4.4, fontWeight: 600, color: c.gray300 },
  '& .meta': { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  '& .tag': {
    padding: '1px 2.5px',
    borderRadius: 1.3,
    background: c.gray100,
    fontSize: 3.5,
    color: c.gray300,
  },
  '& .dday': { fontSize: 3.8, color: c.gray200 },
}));

function Mini(props: { x: number; y: number; rotate?: number }) {
  return (
    <MiniCard {...props} aria-hidden="true">
      <div>
        <p>.....</p>
        <div className="meta">
          <span className="tag">IT/SW</span>
          <p className="dday">D-7</p>
        </div>
      </div>
    </MiniCard>
  );
}

export function PeopleBanners() {
  return (
    <Row>
      <TeamBanner>
        {/* 블러·왼쪽 페이드가 Figma 렌더로 이미 반영된 이미지(1334:22794)라 별도 filter 없이 쓴다. */}
        <Layer style={{ inset: 0 }}>
          <Image
            src="/assets/people/banner-team-bg.png"
            alt=""
            fill
            sizes="861px"
            style={{ objectFit: 'cover' }}
          />
        </Layer>
        <Layer style={{ right: -12, top: 71.5, width: 368, height: 175 }}>
          <Image
            src="/assets/people/banner-team-people.png"
            alt=""
            fill
            sizes="368px"
            style={{ objectFit: 'cover' }}
          />
        </Layer>
        <TeamTitle>
          필요한 팀원을
          <br />
          추천기능으로 찾아보세요
        </TeamTitle>
        {/* TODO: 팀원 추천 전용 화면이 아직 없어 팀 탐색으로 연결한다. */}
        <UseButton href="/teams">지금 사용하기</UseButton>
      </TeamBanner>
      <ContestBanner href="/explore" aria-label="합격 확률 높은 공모전 추천">
        <Layer style={{ left: -13, top: -717.5, width: 632, height: 1122, opacity: 0.12 }}>
          <Image
            src="/assets/people/banner-contest-bg.png"
            alt=""
            fill
            sizes="632px"
            style={{ objectFit: 'cover' }}
          />
        </Layer>
        <Layer style={{ left: 5, top: 14.5, width: 76, height: 68 }}>
          <Image
            src="/assets/people/banner-contest-percent.png"
            alt=""
            fill
            sizes="76px"
            style={{ objectFit: 'cover' }}
          />
        </Layer>
        <CardGroup>
          <Mini x={7.2} y={21} rotate={-10} />
          <Mini x={94.8} y={0} />
          <Mini x={182.4} y={21} rotate={10} />
        </CardGroup>
        <Fade />
        <ContestTitle>
          합격 확률 높은
          <br />
          공모전 추천
        </ContestTitle>
      </ContestBanner>
    </Row>
  );
}
