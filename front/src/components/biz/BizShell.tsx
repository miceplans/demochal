'use client';
import Link from 'next/link';
import { createContext, useContext, usePathname, type ReactNode } from 'react';
import { Global } from '@emotion/react';
import styled from '@emotion/styled';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { siteHref } from '@/lib/biz';
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
      body: { fontFamily: 'Pretendard', fontSize: 15, color: c.gray900, background: c.white },
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
  return (
    <BizBrand href="/" aria-label="SEMO.BIZ 홈" style={{ fontSize: size, fontWeight: 600 }}>
      <img
        src="/assets/SEMOBIZ.png"
        alt="SEMO.BIZ"
        width={size * 4}
        height={size * 1.1}
        style={{ objectFit: 'contain', width: size * 4, height: 'auto' }}
      />
    </BizBrand>
  );
}

const SidebarBox = styled.aside({
  width: 220,
  minWidth: 220,
  borderRight: `1px solid ${c.gray100}`,
  padding: '28px 18px',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  alignSelf: 'stretch',
});
const NavItems = styled.nav({ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 24 });
const NavItem = styled(Link)<{ active?: boolean }>(({ active }) => ({
  display: 'block',
  padding: '10px 12px',
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 600,
  color: active ? c.gray900 : c.gray700,
  background: active ? c.lightBlue : 'transparent',
}));
const Profile = styled(Link)({ display: 'flex', alignItems: 'center', gap: 10 });
const Avatar = styled.span({
  width: 34,
  height: 34,
  borderRadius: '50%',
  background: '#eff6ff',
  color: c.primary,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 13,
  fontWeight: 700,
});

export const menu: [string, string][] = [
  ['/dashboard', '대시보드'],
  ['/postings', '공고 관리'],
  ['/ads', '광고 관리'],
  ['/billing', '결제 내역 관리'],
  ['/operations', '운영대행'],
];

export function BizSidebar() {
  const route = routeOf(usePathname());
  const base = useBizBase();
  return (
    <SidebarBox>
      <div>
        <Logo size={20} />
        <NavItems aria-label="기업 콘솔 메뉴">
          {menu.map(([href, label]) => (
            <NavItem
              key={href}
              href={`${base}${href}`}
              active={route.startsWith(href) ? true : undefined}
              aria-current={route.startsWith(href) ? 'page' : undefined}
            >
              {label}
            </NavItem>
          ))}
        </NavItems>
      </div>
      <Profile href={`${base}/profile`} aria-label="나의 정보">
        <Avatar aria-hidden>{admin.name[0]}</Avatar>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <strong style={{ fontSize: 13 }}>{admin.name}</strong>
          <span style={{ fontSize: 11, color: '#6b7280' }}>{admin.company}</span>
        </span>
      </Profile>
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
export function BizFooter() {
  return (
    <FooterBox>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Logo size={24} />
        <nav style={{ display: 'flex', gap: 12, fontSize: 15 }}>
          <a href={siteHref('/privacy')}>개인정보처리방침</a>
          <a href={siteHref('/terms')}>이용약관</a>
          <span>광고 운영정책</span>
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
      <div
        style={{
          display: 'flex',
          alignItems: 'stretch',
          width: '100%',
          minHeight: 'calc(100dvh - 366px)',
        }}
      >
        <BizSidebar />
        <main
          style={{
            minWidth: 0,
            flex: 1,
            padding: '56px 60px 96px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {children}
        </main>
      </div>
      {footer && <BizFooter />}
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
export const PageTitle = styled.h1({ fontSize: 20, fontWeight: 600 });
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
  fontSize: 13,
  fontWeight: 600,
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
  fontSize: 18,
});
export const FieldInput = styled.input({
  height: 40,
  border: `1px solid ${c.gray300}`,
  borderRadius: 8,
  padding: '0 14px',
  background: c.white,
  '&::placeholder': { color: c.gray500 },
});
export const FieldSelect = styled.select({
  height: 40,
  border: `1px solid ${c.gray300}`,
  borderRadius: 8,
  padding: '0 14px',
  background: c.white,
  color: c.gray700,
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
  fontSize: 16,
  borderTop: `1px solid ${c.gray100}`,
});
export const StatBox = styled.div({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: 20,
  border: `1px solid ${c.gray200}`,
  borderRadius: 12,
  minWidth: 0,
});
export const StatValue = styled.strong({ fontSize: 28, fontWeight: 700 });
export const Delta = styled.span({ fontSize: 12, color: c.green });
export const StatusTag = styled.span<{ tone: 'blue' | 'gray' | 'red' | 'green' }>(({ tone }) => ({
  fontSize: 11,
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
