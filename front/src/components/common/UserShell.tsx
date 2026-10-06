'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { Global } from '@emotion/react';
import styled from '@emotion/styled';
import { colors as c, shadows as s, mobile } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { Icon, Row, DesktopOnly, MobileOnly, Input, IconButton, Button } from './Primitives';
import { useUserStore } from '@/stores/useUserStore';
import { generated } from '@semochal/api-client';
import { useNotificationStream } from '@/lib/useNotificationStream';

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
  borderBottom: `0.5px solid ${c.gray100}`,
  padding: compact
    ? '12px max(24px, calc((100% - 1200px) / 2))'
    : '8px max(24px, calc((100% - 1200px) / 2))',
  [mobile]: { display: 'none' },
}));
const Search = styled.form({
  display: 'flex',
  alignItems: 'center',
  border: `0.5px solid ${c.gray100}`,
  borderRadius: 8,
  gap: 8,
  padding: '0 16px',
  width: 'min(591px, 55vw)',
  '& input': { border: 0, padding: 0, height: 42 },
  '& input:focus': { outline: 'none', boxShadow: 'none' },
  '&:focus-within': { boxShadow: s.focus },
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
      <Icon src="/assets/icons/search.png" size={16} alt="검색" />
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
  '& a': {
    padding: '8px 10px',
    ...textStyle.body,
    color: c.gray700,
    borderRadius: 6,
    transition: 'background 0.15s ease, color 0.15s ease',
  },
  '& a:hover': { background: c.gray50 },
  '& a[aria-current=page]': { color: c.primary, background: c.gray50 },
});
const HeaderActionLink = styled(Link)({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 36,
  padding: '0 12px',
  borderRadius: 6,
  color: c.gray900,
  ...textStyle.bodySmall,
  fontWeight: 600,
  whiteSpace: 'nowrap',
  transition: 'background 0.15s ease',
  '&:hover': { background: c.gray50 },
});
const MobileHeader = styled.header({
  display: 'none',
  [mobile]: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    padding: '16px',
    borderBottom: `0.5px solid ${c.gray100}`,
  },
});
const MobileTitleBar = styled.div({
  display: 'grid',
  gridTemplateColumns: '44px minmax(0, 1fr) 44px',
  alignItems: 'center',
  width: '100%',
  minWidth: 0,
  minHeight: 44,
});
const MobileBackLink = styled(Link)({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 44,
  height: 44,
  marginLeft: -10,
  borderRadius: 6,
  fontSize: 28,
  lineHeight: 1,
  color: c.gray900,
  transition: 'background 0.15s ease, transform 0.1s ease',
  '&:active': { transform: 'scale(0.88)' },
});
const MobileTitle = styled.h1({
  minWidth: 0,
  margin: 0,
  overflow: 'hidden',
  textAlign: 'center',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  ...textStyle.h1_2,
  fontSize: 18,
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
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 'calc(78px + env(safe-area-inset-bottom))',
    padding: '10px 20px calc(20px + env(safe-area-inset-bottom))',
    boxSizing: 'border-box',
    '& a': {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 58,
      height: 58,
      padding: 12,
      borderRadius: 6,
      boxSizing: 'border-box',
      transition: 'background 0.15s ease, transform 0.1s ease',
    },
    '& a:active': { transform: 'scale(0.88)' },
    '& a[aria-current=page]': {
      background: c.gray100,
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
  display: 'flex',
  flexDirection: 'column',
  gap: 23,
  ...textStyle.body,
  lineHeight: 'normal',
  [mobile]: { display: 'none' },
});
const SocialCircle = styled.span({
  width: 24,
  height: 24,
  borderRadius: 18,
  background: c.gray500,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
});
export function Footer() {
  return (
    <FooterBox>
      <Row style={{ justifyContent: 'space-between' }}>
        <Logo dot mono />
        <Row style={{ color: c.gray900 }}>
          <Link href="/privacy">개인정보처리방침</Link>
          <Link href="/terms">이용약관</Link>
          <Link href="/youth">청소년 보호 정책</Link>
        </Row>
      </Row>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div
          style={{ display: 'flex', flexDirection: 'column', gap: 6, width: 329, color: c.gray900 }}
        >
          <span>대표 유철한</span>
          <span>사업자등록번호 617-81-98126</span>
          <span>부산광역시 해운대구 센텀북대로 60 센텀IS타워 1807호</span>
          <span>051-783-1170 / mice@miceplans.com</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
          <Row style={{ gap: 4 }}>
            <a
              href="https://www.miceplans.com/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="MICEPLANS"
            >
              <SocialCircle>
                <img
                  src="/assets/icons/figma-footer/miceplans.svg"
                  alt=""
                  width={13.41}
                  height={12}
                />
              </SocialCircle>
            </a>
            <a
              href="https://www.youtube.com/@icclabcreativecontentslab6004/videos"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="YouTube"
            >
              <SocialCircle>
                <img
                  src="/assets/icons/figma-footer/youtube.svg"
                  alt=""
                  width={14.19}
                  height={10}
                />
              </SocialCircle>
            </a>
            <a
              href="https://www.instagram.com/miceplans/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              style={{ display: 'flex' }}
            >
              <img src="/assets/icons/figma-footer/instagram.svg" alt="" width={24} height={24} />
            </a>
          </Row>
          <span style={{ color: c.gray500 }}>© MICEPLANS. ALL Rights Reserved.</span>
        </div>
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
  hideMobileHeader = false,
  back = '/my',
}: {
  children: ReactNode;
  title?: string;
  compact?: boolean;
  footer?: boolean;
  navigation?: boolean;
  hideMobileHeader?: boolean;
  back?: string;
}) {
  const path = usePathname();
  useEffect(() => {
    void useUserStore.persist.rehydrate();
  }, []);
  const { data: auth } = generated.useGetMyAuthInfo({ query: { retry: false } });
  const isLoggedIn = auth?.status === 200;
  useNotificationStream(isLoggedIn);
  const navItems = [
    ['/', '홈', '/assets/icons/figma-footer/home.svg'],
    ['/explore', '챌린지 탐색', '/assets/icons/figma-footer/search.svg'],
    ['/teams', '팀 탐색', '/assets/icons/figma-footer/team.svg'],
    ['/notifications', '알림', '/assets/icons/figma-footer/alert.svg'],
    ['/my', 'MY', '/assets/icons/figma-footer/account.svg'],
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
          body: { ...textStyle.body, color: c.gray900, background: c.white },
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
        <Row
          style={{
            justifyContent: compact && !navigation ? 'center' : 'space-between',
            minHeight: compact ? 31 : 56,
          }}
        >
          <Logo />
          {!compact && (
            <>
              <SearchBar />
              <Row gap={20}>
                {isLoggedIn ? (
                  <>
                    <Link href="/notifications" aria-label="알림">
                      <Icon src="/assets/icons/bell.png" alt="알림" />
                    </Link>
                    <Link href="/my" aria-label="내 프로필">
                      <Icon src="/assets/icons/profile.png" alt="프로필" />
                    </Link>
                  </>
                ) : (
                  <>
                    <HeaderActionLink href="/biz/postings/new">챌린지 만들기</HeaderActionLink>
                    <HeaderActionLink href="/biz/operations">챌린지 대행 문의</HeaderActionLink>
                    <Link href="/login">
                      <Button as="span" small>
                        로그인/회원가입
                      </Button>
                    </Link>
                  </>
                )}
              </Row>
            </>
          )}
        </Row>
        {!compact && (
          <Nav>
            <Link href="/explore" aria-current={path.startsWith('/explore') ? 'page' : undefined}>
              챌린지 탐색
            </Link>
            <Link href="/teams" aria-current={path.startsWith('/teams') ? 'page' : undefined}>
              팀 탐색
            </Link>
            <Link href="/people" aria-current={path.startsWith('/people') ? 'page' : undefined}>
              팀원 찾기
            </Link>
          </Nav>
        )}
      </HeaderBox>
      {!hideMobileHeader && (
        <MobileHeader>
          {title ? (
            <MobileTitleBar>
              <MobileBackLink href={back} aria-label="뒤로가기">
                ‹
              </MobileBackLink>
              <MobileTitle>{title}</MobileTitle>
            </MobileTitleBar>
          ) : (
            <>
              <Logo dot />
              {!compact && <SearchBar />}
            </>
          )}
        </MobileHeader>
      )}
      <main style={{ minWidth: 0, flex: 1 }}>
        <div>{children}</div>
      </main>
      {footer && <Footer />}
      {navigation && (
        <>
          <MobileOnly style={{ height: 'calc(78px + env(safe-area-inset-bottom))' }} />
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
                <Icon src={icon} size={34} alt={label} />
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
  ['/my/account', '계정 설정'],
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
  borderRight: `0.5px solid ${c.gray100}`,
  padding: '40px 0',
  '& a': {
    display: 'block',
    padding: '13px 16px',
    ...textStyle.bodySmall,
    color: c.gray700,
    borderRadius: 8,
    transition: 'background 0.15s ease, color 0.15s ease',
  },
  '& a:hover': { background: c.gray50, color: c.gray900 },
  '& a[aria-current=page]': { background: c.gray100 },
  [mobile]: { display: 'none' },
});
export function MyShell({ children, title }: { children: ReactNode; title: string }) {
  const path = usePathname();
  const { data: auth } = generated.useGetMyAuthInfo({ query: { retry: false } });
  const userName = auth?.status === 200 ? (auth.data.name ?? '사용자') : '';
  return (
    <UserShell compact title={title}>
      <MyGrid>
        <MyAside>
          <Link href="/my">
            <Row>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: c.gray100 }} />
              {userName}
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
