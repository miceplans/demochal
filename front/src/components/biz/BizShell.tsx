'use client';
import Link from 'next/link';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Global } from '@emotion/react';
import styled from '@emotion/styled';
import { colors as c, shadows as s, mobile } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { usePathname } from 'next/navigation';
import { admin } from '@/data/biz-design';

const BizNavContext = createContext('');
export function BizNavProvider({ base, children }: { base: string; children: ReactNode }) {
  return <BizNavContext.Provider value={base}>{children}</BizNavContext.Provider>;
}
export const useBizBase = () => useContext(BizNavContext);
export function useBizHref() {
  const base = useBizBase();
  return (path: string) => `${base}${path === '/' ? '' : path}`;
}
export function BizLink({
  href,
  ...rest
}: { href: string; children: ReactNode } & Omit<Parameters<typeof Link>[0], 'href'>) {
  const hrefOf = useBizHref();
  return <Link href={hrefOf(href)} {...rest} />;
}
export function routeOf(pathname: string) {
  return pathname.startsWith('/biz') ? pathname.slice(4) || '/' : pathname;
}

export const BizGlobalStyles = (
  <Global
    styles={{
      body: { ...textStyle.body, color: c.gray900, background: c.white },
      'button,input,select,textarea': {
        fontFamily: 'Pretendard',
        fontSize: 'inherit',
        color: 'inherit',
      },
      button: { cursor: 'pointer' },
      ':focus-visible': { outline: `2px solid ${c.primary}`, outlineOffset: 3 },
      img: { display: 'block' },
    }}
  />
);

export const BizBrand = styled(Link)({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  whiteSpace: 'nowrap',
});
export function Logo({ size = 24 }: { size?: number }) {
  const hrefOf = useBizHref();
  return (
    <BizBrand href={hrefOf('/dashboard')} aria-label="SEMO.BIZ 홈">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/assets/SEMOBIZ.png" alt="SEMO.BIZ" style={{ height: size, width: 'auto', display: 'block' }} />
    </BizBrand>
  );
}

const LandingHeaderBar = styled.header<{ floating: boolean }>(({ floating }) => ({
  position: 'fixed',
  left: '50%',
  transform: 'translateX(-50%)',
  top: floating ? 16 : 0,
  width: floating ? 'calc(100% - 32px)' : '100%',
  maxWidth: floating ? 1280 : '100%',
  height: 64,
  zIndex: 50,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: floating ? '0 32px' : '0 80px',
  background: floating ? 'rgba(255, 255, 255, 0.72)' : c.white,
  backdropFilter: floating ? 'blur(16px)' : 'none',
  WebkitBackdropFilter: floating ? 'blur(16px)' : 'none',
  borderRadius: floating ? 16 : 0,
  border: `0.5px solid ${floating ? 'rgba(223, 226, 231, 0.6)' : c.gray100}`,
  boxShadow: floating ? '0 16px 40px rgba(16, 20, 30, 0.10)' : 'none',
  transition:
    'top 360ms cubic-bezier(0.22, 1, 0.36, 1), width 360ms cubic-bezier(0.22, 1, 0.36, 1), padding 360ms cubic-bezier(0.22, 1, 0.36, 1), border-radius 360ms cubic-bezier(0.22, 1, 0.36, 1), background 360ms ease, border-color 360ms ease, box-shadow 360ms ease',
  [mobile]: {
    top: floating ? 8 : 0,
    width: floating ? 'calc(100% - 16px)' : '100%',
    padding: floating ? '0 16px' : '0 20px',
  },
}));
const HeaderCtas = styled.div({ display: 'flex', gap: 8 });
const HeaderJoin = styled(BizLink)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 130,
  height: 37,
  borderRadius: 6,
  background: c.primary,
  color: c.white,
  ...textStyle.subtitle,
  fontSize: 13,
  [mobile]: { width: 'auto', padding: '0 12px' },
});
const HeaderSignup = styled(BizLink)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 130,
  height: 37,
  borderRadius: 6,
  background: c.white,
  border: `1px solid ${c.gray200}`,
  color: c.gray900,
  ...textStyle.overline,
  fontSize: 12,
  [mobile]: { width: 'auto', padding: '0 12px' },
});

export function BizLandingHeader() {
  const [floating, setFloating] = useState(false);

  useEffect(() => {
    let ticking = false;
    const update = () => {
      setFloating(window.scrollY > 24);
      ticking = false;
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <LandingHeaderBar floating={floating}>
      <Logo size={26} />
      <HeaderCtas>
        <HeaderJoin href="/login">챌린지 문의하기</HeaderJoin>
        <HeaderSignup href="/login">가입하기</HeaderSignup>
      </HeaderCtas>
    </LandingHeaderBar>
  );
}

const SidebarBox = styled.aside({
  position: 'fixed',
  top: 0,
  left: 0,
  bottom: 0,
  width: 220,
  borderRight: `1px solid ${c.gray100}`,
  padding: '28px 18px',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  overflowY: 'auto',
  zIndex: 10,
});
const SidebarTop = styled.div({ display: 'flex', flexDirection: 'column', gap: 24 });
const NavItems = styled.nav({ display: 'flex', flexDirection: 'column', width: 183 });
const NavItem = styled(Link, { shouldForwardProp: (prop) => prop !== 'active' })<{ active?: boolean }>(
  ({ active }) => ({
  display: 'block',
  padding: '10px 12px',
  borderRadius: 6,
  textAlign: 'left',
  ...textStyle.subtitle,
  color: '#111111',
  background: active
    ? 'linear-gradient(90deg, rgba(11, 110, 255, 0.1) 0%, rgba(255, 255, 255, 0.1) 100%)'
    : 'transparent',
}));

const ProfileRow = styled.div({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
});
const AdminIdentity = styled(Link)({ display: 'flex', alignItems: 'center', gap: 10 });
const Avatar = styled.span({
  width: 34,
  height: 34,
  borderRadius: '50%',
  background: '#EFF6FF',
  color: c.primary,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  ...textStyle.caption2,
});
const LogoutIcon = styled(Link)({ display: 'inline-flex', color: '#6B7280' });

export const menu: [string, string][] = [
  ['/dashboard', '대시보드'],
  ['/postings/new', '챌린지 만들기'],
  ['/postings', '공고 관리'],
  ['/applications', '지원자 관리'],
  ['/ads', '광고 관리'],
  ['/billing', '결제 내역 관리'],
  ['/operations', '운영대행'],
  ['/profile/edit','기업 프로필'],
];

export function isMenuActive(route: string, href: string) {
  if (href === '/dashboard') return route === '/' || route === '/dashboard';
  return route.startsWith(href);
}

export function BizSidebar() {
  const route = routeOf(usePathname());
  const base = useBizBase();
  return (
    <SidebarBox>
      <SidebarTop>
        <Logo size={28} />
        <NavItems aria-label="기업 콘솔 메뉴">
          {menu.map(([href, label]) => (
            <NavItem
              key={href}
              href={`${base}${href}`}
              active={isMenuActive(route, href) ? true : undefined}
              aria-current={isMenuActive(route, href) ? 'page' : undefined}
            >
              {label}
            </NavItem>
          ))}
        </NavItems>
      </SidebarTop>
      <ProfileRow>
        <AdminIdentity href={`${base}/profile`} aria-label="내 프로필">
          <Avatar aria-hidden>{admin.name[0]}</Avatar>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <strong style={{ ...textStyle.caption2, color: '#111827' }}>{admin.name}</strong>
            <span style={{ fontSize: 11, fontWeight: 500, color: '#6B7280' }}>{admin.company}</span>
          </span>
        </AdminIdentity>
        <LogoutIcon href={`${base}/login`} aria-label="로그아웃">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M5 21C4.45 21 3.97917 20.8042 3.5875 20.4125C3.19583 20.0208 3 19.55 3 19V5C3 4.45 3.19583 3.97917 3.5875 3.5875C3.97917 3.19583 4.45 3 5 3H11C11.2833 3 11.5208 3.09583 11.7125 3.2875C11.9042 3.47917 12 3.71667 12 4C12 4.28333 11.9042 4.52083 11.7125 4.7125C11.5208 4.90417 11.2833 5 11 5H5V19H11C11.2833 19 11.5208 19.0958 11.7125 19.2875C11.9042 19.4792 12 19.7167 12 20C12 20.2833 11.9042 20.5208 11.7125 20.7125C11.5208 20.9042 11.2833 21 11 21H5ZM17.175 13H10C9.71667 13 9.47917 12.9042 9.2875 12.7125C9.09583 12.5208 9 12.2833 9 12C9 11.7167 9.09583 11.4792 9.2875 11.2875C9.47917 11.0958 9.71667 11 10 11H17.175L15.3 9.125C15.1167 8.94167 15.025 8.71667 15.025 8.45C15.025 8.18333 15.1167 7.95 15.3 7.75C15.4833 7.55 15.7167 7.44583 16 7.4375C16.2833 7.42917 16.525 7.525 16.725 7.725L20.3 11.3C20.5 11.5 20.6 11.7333 20.6 12C20.6 12.2667 20.5 12.5 20.3 12.7L16.725 16.275C16.525 16.475 16.2875 16.5708 16.0125 16.5625C15.7375 16.5542 15.5 16.45 15.3 16.25C15.1167 16.05 15.0292 15.8125 15.0375 15.5375C15.0458 15.2625 15.1417 15.0333 15.325 14.85L17.175 13Z"
              fill="currentColor"
            />
          </svg>
        </LogoutIcon>
      </ProfileRow>
    </SidebarBox>
  );
}

const FooterBox = styled.footer({
  background: `linear-gradient(180deg, ${c.white} 0%, #e7f2ff 100%)`,
  padding: '50px 60px',
  display: 'flex',
  flexDirection: 'column',
  gap: 148,
});
export function BizFooter({ logoSize = 24 }: { logoSize?: number }) {
  const hrefOf = useBizHref();
  return (
    <FooterBox>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Logo size={logoSize} />
        <nav style={{ display: 'flex', gap: 12, ...textStyle.body }}>
          <Link href={hrefOf('/privacy')}>개인정보처리방침</Link>
          <Link href={hrefOf('/terms')}>이용약관</Link>
          <Link href={hrefOf('/advertising')}>광고 운영정책</Link>
        </nav>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
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
      </div>
    </FooterBox>
  );
}

export function BizShell({ children, footer = true }: { children: ReactNode; footer?: boolean }) {
  return (
    <>
      {BizGlobalStyles}
      <BizSidebar />
      <div
        style={{
          marginLeft: 220,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <main
          style={{
            minWidth: 0,
            minHeight: '100dvh',
            padding: '80px 60px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16,
          }}
        >
          {children}
        </main>
        {footer && <BizFooter />}
      </div>
    </>
  );
}

export const BizContent = styled.div({
  width: '100%',
  maxWidth: 1100,
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 48,
});
export const PageTitle = styled.h1(textStyle.h1_2);
export const SectionTitle = styled.h2(textStyle.h2_2);
export const SectionHeader = styled.div({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
});
export const PrimaryButton = styled.button({
  border: 0,
  borderRadius: 6,
  background: c.primary,
  color: c.white,
  ...textStyle.subtitle,
  padding: '10px 12px',
  '&:hover:not(:disabled)': { background: '#005ee0' },
  '&:disabled': { opacity: 0.5, cursor: 'not-allowed' },
});
export const OutlineButton = styled.button({
  border: `1px solid ${c.gray200}`,
  borderRadius: 6,
  background: c.white,
  color: c.gray900,
  ...textStyle.overline,
  padding: '10px 12px',
  '&:hover': { background: c.gray50 },
});
export const Field = styled.label({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  ...textStyle.h2_2,
});
export const FieldInput = styled.input({
  height: 40,
  border: `1px solid ${c.gray300}`,
  borderRadius: 8,
  padding: '0 14px',
  background: c.white,
  '&::placeholder': { color: c.gray500 },
  '&:focus': { outline: 'none', boxShadow: s.focus },
});
export const FieldSelect = styled.select({
  height: 40,
  border: `1px solid ${c.gray300}`,
  borderRadius: 8,
  padding: '0 14px',
  background: c.white,
  color: c.gray700,
  '&:focus': { outline: 'none', boxShadow: s.focus },
});
export const TableBox = styled.div({
  border: `1px solid ${c.gray100}`,
  borderRadius: 12,
  overflow: 'hidden',
});
export const THead = styled.div({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '14px 16px',
  background: c.gray100,
  ...textStyle.h3_2,
});
export const TRow = styled.div({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '18px 16px',
  background: c.white,
  ...textStyle.h1,
  borderTop: `1px solid ${c.gray100}`,
});
export const StatBox = styled.div({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: 20,
  border: `1px solid ${c.gray100}`,
  borderRadius: 12,
  minWidth: 0,
});
export const StatValue = styled.strong({ fontSize: 28, fontWeight: 700 });
export const Delta = styled.span({ ...textStyle.metaText, color: c.green });
export const StatusTag = styled.span<{ tone: 'blue' | 'gray' | 'red' | 'green' }>(({ tone }) => ({
  ...textStyle.label,
  padding: '4px 8px',
  borderRadius: 4,
  background:
    tone === 'blue'
      ? c.lightBlue
      : tone === 'green'
        ? c.lightGreen
        : tone === 'red'
          ? c.lightRed
          : c.gray100,
  color:
    tone === 'blue' ? c.primary : tone === 'green' ? c.green : tone === 'red' ? c.red : c.gray700,
}));
