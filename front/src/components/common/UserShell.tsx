'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { Global } from '@emotion/react';
import styled from '@emotion/styled';
import { colors as c, mobile } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { Icon, Row, DesktopOnly, MobileOnly, Input, IconButton } from './Primitives';
import { useUserStore } from '@/stores/useUserStore';

const Brand = styled(Link)({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  ...textStyle.display,
  whiteSpace: 'nowrap',
});
export function Logo({ dot = false, mono = false }: { dot?: boolean; mono?: boolean }) {
  return (
    <Brand href="/" aria-label="SEMO 홈">
      <img
        src={mono ? '/assets/SEMO-mono.png' : '/assets/SEMO.png'}
        alt={dot ? 'SEMO.' : 'SEMO'}
        width={96}
        height={28}
        style={{ display: 'block', objectFit: 'contain' }}
      />
    </Brand>
  );
}
const HeaderBox = styled.header<{ compact: boolean }>(({ compact }) => ({
  background: c.white,
  borderBottom: `1px solid ${c.gray100}`,
  padding: compact
    ? '12px max(24px, calc((100% - 1200px) / 2))'
    : '8px max(24px, calc((100% - 1200px) / 2))',
  [mobile]: { display: 'none' },
}));
const Search = styled.form({
  display: 'flex',
  alignItems: 'center',
  border: `1px solid ${c.gray100}`,
  borderRadius: 8,
  gap: 8,
  padding: '0 16px',
  width: 'min(591px, 55vw)',
  '& input': { border: 0, padding: 0, height: 42 },
  [mobile]: {
    background: '#f7f8fa',
    width: '100%',
    border: 0,
    borderRadius: 14,
    '& input': { background: 'transparent' },
  },
});
function SearchBar() {
  const query = useUserStore((s) => s.query),
    setQuery = useUserStore((s) => s.setQuery);
  const router = useRouter();
  return (
    <Search
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        router.push('/explore');
      }}
    >
      <Icon name="imgSIc" size={16} />
      <Input
        aria-label="챌린지, 팀, 분야 검색"
        placeholder="챌린지, 팀, 분야를 검색하세요"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
    </Search>
  );
}
const Nav = styled.nav({
  display: 'flex',
  gap: 8,
  paddingTop: 4,
  '& a': { padding: '8px 10px', fontSize: 15, color: c.gray700, borderRadius: 6 },
  '& a[aria-current=page]': { color: c.primary, background: c.gray50 },
});
const MobileHeader = styled.header({
  display: 'none',
  [mobile]: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    padding: '16px',
    borderBottom: `1px solid ${c.gray100}`,
  },
});
const Bottom = styled.nav({
  display: 'none',
  [mobile]: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    background: c.white,
    display: 'flex',
    justifyContent: 'space-around',
    alignItems: 'center',
    height: 'calc(72px + env(safe-area-inset-bottom))',
    paddingBottom: 'env(safe-area-inset-bottom)',
    '& a': {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 56,
      height: 52,
      borderRadius: 8,
    },
    '& a[aria-current=page]': {
      background: c.gray50,
      '& img': {
        filter:
          'invert(33%) sepia(96%) saturate(4178%) hue-rotate(207deg) brightness(100%) contrast(106%)',
      },
    },
  },
});
const FooterBox = styled.footer({
  background: c.gray50,
  padding: '50px 60px',
  minHeight: 367,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  gap: 100,
  fontSize: 15,
  [mobile]: { display: 'none' },
});
export function Footer() {
  return (
    <FooterBox>
      <Row style={{ justifyContent: 'space-between' }}>
        <Logo dot mono />
        <Row>
          <Link href="/privacy">개인정보처리방침</Link>
          <Link href="/terms">이용약관</Link>
          <span>청소년 보호 정책</span>
        </Row>
      </Row>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div style={{ lineHeight: 1.65, maxWidth: 329 }}>
          대표 유철한
          <br />
          사업자등록번호 617-81-98126
          <br />
          부산광역시 해운대구 센텀북대로 60 센텀IS타워 1807호
          <br />
          051-783-1170 / mice@miceplans.com
        </div>
        <span style={{ color: c.gray500 }}>© MICEPLANS. ALL Rights Reserved.</span>
      </Row>
    </FooterBox>
  );
}
export function UserShell({
  children,
  title,
  compact = false,
  footer = true,
  navigation = true,
  back = '/my',
}: {
  children: ReactNode;
  title?: string;
  compact?: boolean;
  footer?: boolean;
  navigation?: boolean;
  back?: string;
}) {
  const path = usePathname();
  useEffect(() => {
    void useUserStore.persist.rehydrate();
  }, []);
  const navItems = [
    ['/', '홈', 'imgFrame'],
    ['/explore', '공모전 탐색', 'imgFrame1'],
    ['/teams', '팀 탐색', 'imgFrame2'],
    ['/notifications', '알림', 'imgFrame3'],
    ['/my', 'MY', 'imgFrame4'],
  ];
  return (
    <>
      <Global
        styles={{
          '@font-face': {
            fontFamily: 'Pretendard',
            src: 'url(/fonts/PretendardVariable.woff2) format("woff2")',
            fontWeight: '100 900',
            fontStyle: 'normal',
            fontDisplay: 'swap',
          },
          body: { fontFamily: 'Pretendard', fontSize: 15, color: c.gray900, background: c.white },
          'button,input,select,textarea': {
            fontFamily: 'Pretendard',
            fontSize: 'inherit',
            color: 'inherit',
          },
          button: { cursor: 'pointer' },
          'button:disabled': { cursor: 'not-allowed' },
          ':focus-visible': { outline: `2px solid ${c.primary}`, outlineOffset: 3 },
          'input,select,textarea': { accentColor: c.primary },
          img: { display: 'block' },
        }}
      />
      <HeaderBox compact={compact}>
        <Row style={{ justifyContent: 'space-between', minHeight: compact ? 31 : 56 }}>
          <Logo />
          {!compact && (
            <>
              <SearchBar />
              <Row gap={20}>
                <Link href="/notifications" aria-label="알림">
                  <Icon name="imgIcBell" />
                </Link>
                <Link href="/my" aria-label="내 프로필">
                  <Icon name="imgIcProfile" />
                </Link>
              </Row>
            </>
          )}
        </Row>
        {!compact && (
          <Nav>
            <Link href="/explore" aria-current={path.startsWith('/explore') ? 'page' : undefined}>
              공모전 탐색
            </Link>
            <Link href="/teams" aria-current={path.startsWith('/teams') ? 'page' : undefined}>
              팀 탐색
            </Link>
          </Nav>
        )}
      </HeaderBox>
      <MobileHeader>
        {title ? (
          <Row style={{ minHeight: 28 }}>
            <Link href={back} aria-label="뒤로">
              <span style={{ display: 'block', transform: 'rotate(180deg)' }}>
                <Icon frame="839-13815" name="imgMoreIcon" size={16} />
              </span>
            </Link>
            <h1 style={{ fontSize: 18 }}>{title}</h1>
          </Row>
        ) : (
          <>
            <Logo dot />
            {!compact && <SearchBar />}
          </>
        )}
      </MobileHeader>
      <main style={{ minWidth: 0, flex: 1 }}>
        <div>{children}</div>
      </main>
      {footer && <Footer />}
      {navigation && (
        <>
          <MobileOnly style={{ height: 88 }} />
          <Bottom aria-label="하단 메뉴">
            {navItems.map(([href, label, icon]) => (
              <Link
                key={href}
                href={href}
                aria-label={label}
                aria-current={
                  (href === '/' ? path === '/' : path.startsWith(href)) ? 'page' : undefined
                }
              >
                <Icon frame="839-13815" name={icon} size={28} />
              </Link>
            ))}
          </Bottom>
        </>
      )}
    </>
  );
}
export const Content = styled.div({
  width: 'min(1200px, calc(100% - 48px))',
  margin: '0 auto',
  padding: '40px 0',
  [mobile]: { width: '100%', padding: '24px 16px' },
});
export const myMenu = [
  ['/my/teams', '내 팀'],
  ['/my/bookmarks', '북마크 챌린지'],
  ['/my/applications', '지원현황'],
  ['/my/interests', '관심분야 설정'],
  ['/my/notifications', '알림 설정'],
];
const MyGrid = styled.div({
  display: 'grid',
  gridTemplateColumns: '240px minmax(0, 1fr)',
  maxWidth: 1200,
  margin: 'auto',
  minHeight: 562,
  [mobile]: { display: 'block', minHeight: 0 },
});
const MyAside = styled.aside({
  borderRight: `1px solid ${c.gray100}`,
  padding: '40px 0',
  '& a': {
    display: 'block',
    padding: '13px 16px',
    fontSize: 14,
    color: c.gray700,
    borderRadius: 8,
  },
  '& a[aria-current=page]': { background: c.gray100 },
  [mobile]: { display: 'none' },
});
export function MyShell({ children, title }: { children: ReactNode; title: string }) {
  const path = usePathname();
  return (
    <UserShell compact title={title}>
      <MyGrid>
        <MyAside>
          <Link href="/my">
            <Row>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: c.gray100 }} />
              황지영
            </Row>
          </Link>
          {myMenu.map(([href, label]) => (
            <Link href={href} key={href} aria-current={path.startsWith(href) ? 'page' : undefined}>
              {label}
            </Link>
          ))}
        </MyAside>
        <div style={{ minWidth: 0 }}>
          <MyContent>{children}</MyContent>
        </div>
      </MyGrid>
    </UserShell>
  );
}
const MyContent = styled.div({ padding: '32px', [mobile]: { padding: '20px 16px' } });
