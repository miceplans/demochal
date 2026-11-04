'use client';

import Link from 'next/link';
import styled from '@emotion/styled';
import { colors as c, mobile } from '@/styles/design';
import { textStyle } from '@/styles/typography';

// Figma "01 · 사람찾기 목록"(1453-8507)의 점검 안내 화면.
// 서버가 점검 모드(503)일 때 MaintenanceGate가 페이지 콘텐츠 대신 렌더링한다.
const Page = styled.div({
  minHeight: '100svh',
  display: 'flex',
  flexDirection: 'column',
  background: c.white,
});

const HeaderBox = styled.header({
  borderBottom: `0.5px solid ${c.gray100}`,
  padding: '8px max(24px, calc((100% - 1200px) / 2)) 4px',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
});

const HeaderRow = styled.div({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  minHeight: 56,
});

const HomeLink = styled(Link)({
  display: 'inline-flex',
  alignItems: 'center',
});

const RightIcons = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: 20,
  '& img': { display: 'block' },
});

const Nav = styled.nav({
  display: 'flex',
  gap: 8,
  '& a': {
    width: 90,
    padding: '8px 10px',
    borderRadius: 6,
    ...textStyle.body,
    color: c.gray700,
    textAlign: 'center',
    textDecoration: 'none',
    transition: 'background 0.15s ease',
  },
  '& a:hover': { background: c.gray50 },
  [mobile]: { overflowX: 'auto' },
});

const Body = styled.main({
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '60px 80px',
  [mobile]: { padding: '32px 16px' },
});

const MaintenanceContent = styled.div({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 24,
});

const Title = styled.h1({
  margin: 0,
  ...textStyle.display,
  color: c.gray900,
});

const Illustration = styled.img({
  width: 180,
  height: 'auto',
  display: 'block',
});

const Description = styled.p({
  margin: 0,
  ...textStyle.body,
  color: '#000000',
});

const NAV_ITEMS: ReadonlyArray<[href: string, label: string]> = [
  ['/explore', '공모전 탐색'],
  ['/teams', '팀 탐색'],
  ['/people', '팀원 찾기'],
];

export function MaintenanceScreen() {
  return (
    <Page>
      <HeaderBox>
        <HeaderRow>
          <HomeLink href="/" aria-label="SEMO 홈">
            <img src="/assets/SEMO.png" alt="SEMO" width={96} height={28} />
          </HomeLink>
          <RightIcons aria-hidden>
            <img src="/assets/icons/bell.png" alt="" width={20} height={20} />
            <img src="/assets/icons/profile.png" alt="" width={20} height={20} />
          </RightIcons>
        </HeaderRow>
        <Nav>
          {NAV_ITEMS.map(([href, label]) => (
            <Link key={href} href={href}>
              {label}
            </Link>
          ))}
        </Nav>
      </HeaderBox>
      <Body>
        <MaintenanceContent>
          <Title>서버 점검 중입니다.</Title>
          <Illustration
            src="/assets/maintenance.png"
            alt="서버 점검 일러스트"
            width={814}
            height={736}
          />
          <Description>죄송합니다. 더욱 나은 모습으로 찾아 뵙겠습니다!</Description>
        </MaintenanceContent>
      </Body>
    </Page>
  );
}
