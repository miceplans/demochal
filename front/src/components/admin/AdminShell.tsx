'use client';

import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Global } from '@emotion/react';
import styled from '@emotion/styled';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { adminMenu, adminUser } from '@/data/admin-design';

export const AdminGlobalStyles = (
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

const SidebarBox = styled.aside({
  width: 220,
  minWidth: 220,
  background: c.white,
  borderRight: '1px solid #E5E7EB',
  padding: '28px 18px',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  position: 'sticky',
  top: 0,
  height: '100dvh',
  overflowY: 'auto',
});

const BrandRow = styled.div({ display: 'flex', alignItems: 'center', gap: 6 });

const NavItems = styled.nav({ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 24 });
const NavItem = styled(Link, { shouldForwardProp: (prop) => prop !== 'active' })<{ active?: boolean }>(({ active }) => ({
  padding: '10px 12px',
  borderRadius: 6,
  ...textStyle.subtitle,
  color: '#111111',
  background: active
    ? 'linear-gradient(90deg, rgba(11,110,255,0.1) 0%, rgba(255,255,255,0.1) 100%)'
    : 'transparent',
}));

const ProfileRow = styled.div({ display: 'flex', alignItems: 'center', gap: 10 });
const Avatar = styled.span({
  width: 34,
  height: 34,
  borderRadius: '50%',
  background: '#EFF6FF',
  color: c.primary,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  ...textStyle.caption2,
});
const GearIcon = styled.span({ display: 'inline-flex', marginLeft: 'auto', color: c.gray500 });

function AdminSidebar() {
  const pathname = usePathname() ?? '';
  return (
    <SidebarBox>
      <div>
        <BrandRow aria-label="세모챌 관리자">
          <Image src="/assets/SEMOADMIN.png" alt="세모챌 관리자" width={88} height={28} priority />
        </BrandRow>
        <NavItems aria-label="관리자 메뉴">
          {adminMenu.map(([href, label]) => {
            const active =
              href === '/admin' ? pathname === '/admin' && label === '대시보드' : pathname.startsWith(href);
            return (
              <NavItem key={label} href={href} active={active || undefined} aria-current={active ? 'page' : undefined}>
                {label}
              </NavItem>
            );
          })}
        </NavItems>
      </div>
      <ProfileRow>
        <Avatar aria-hidden>{adminUser.name[0]}</Avatar>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <strong style={{ ...textStyle.caption2, color: '#111827' }}>{adminUser.name}</strong>
          <span style={{ fontSize: 11, fontWeight: 500, color: '#6B7280' }}>{adminUser.role}</span>
        </span>
        <GearIcon aria-hidden>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </GearIcon>
      </ProfileRow>
    </SidebarBox>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <>
      {AdminGlobalStyles}
      <div style={{ display: 'flex', alignItems: 'stretch', width: '100%', minHeight: '100dvh' }}>
        <AdminSidebar />
        <main
          style={{
            minWidth: 0,
            flex: 1,
            padding: '32px 40px',
            display: 'flex',
            flexDirection: 'column',
            gap: 24,
            background: c.white,
          }}
        >
          {children}
        </main>
      </div>
    </>
  );
}
