'use client';

import { createContext, useContext, useEffect, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Global } from '@emotion/react';
import styled from '@emotion/styled';
import { generated } from '@semochal/api-client';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { adminMenu } from '@/data/admin-design';

const roleLabel: Record<string, string> = {
  admin: '관리자',
  business: '기업',
  user: '일반 사용자',
};

const AdminNavContext = createContext('');
export function AdminNavProvider({ base, children }: { base: string; children: ReactNode }) {
  return <AdminNavContext.Provider value={base}>{children}</AdminNavContext.Provider>;
}
export const useAdminBase = () => useContext(AdminNavContext);
export function useAdminHref() {
  const base = useAdminBase();
  return (path: string) => `${base}${path === '/' ? '' : path}`;
}
export function routeOf(pathname: string) {
  return pathname.startsWith('/admin') ? pathname.slice('/admin'.length) || '/' : pathname;
}

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

/** 로그아웃 후 로그인 화면으로 보낸다. 실패해도 세션이 남지 않도록 캐시는 항상 비운다. */
function useAdminLogout() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const hrefOf = useAdminHref();
  return () => {
    void generated.logout().finally(() => {
      queryClient.clear();
      router.push(hrefOf('/login'));
    });
  };
}

function AdminSidebar() {
  const logout = useAdminLogout();
  const route = routeOf(usePathname() ?? '');
  const hrefOf = useAdminHref();
  const { data: auth } = generated.useGetMyAuthInfo({ query: { retry: false } });
  const me = auth?.status === 200 ? auth.data : undefined;
  const name = me?.name ?? '';
  const role = me?.role ? (roleLabel[me.role] ?? me.role) : '';
  return (
    <SidebarBox>
      <div>
        <BrandRow aria-label="세모챌 관리자">
          <Image src="/assets/SEMOADMIN.png" alt="세모챌 관리자" width={88} height={28} priority />
        </BrandRow>
        <NavItems aria-label="관리자 메뉴">
          {adminMenu.map(([href, label]) => {
            const active =
              href === '/' ? route === '/' : route === href || route.startsWith(`${href}/`);
            return (
              <NavItem
                key={label}
                href={hrefOf(href)}
                active={active || undefined}
                aria-current={active ? 'page' : undefined}
              >
                {label}
              </NavItem>
            );
          })}
        </NavItems>
      </div>
      <ProfileRow>
        <Avatar aria-hidden>{name.charAt(0)}</Avatar>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <strong style={{ ...textStyle.caption2, color: '#111827' }}>{name}</strong>
          <span style={{ fontSize: 11, fontWeight: 500, color: '#6B7280' }}>{role}</span>
        </span>
        <LogoutButton type="button" onClick={logout}>
          로그아웃
        </LogoutButton>
        <GearIcon href={hrefOf('/settings')} aria-label="설정">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </GearIcon>
      </ProfileRow>
    </SidebarBox>
  );
}

/** 콘솔은 admin 세션에서만 연다: 미인증 → 로그인으로, 비관리자 → 안내 + 로그아웃. */
function AdminAccessGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const hrefOf = useAdminHref();
  const logout = useAdminLogout();
  const {
    data: auth,
    isPending,
    isError,
    refetch,
  } = generated.useGetMyAuthInfo({
    query: { retry: false },
  });
  const me = auth?.status === 200 ? auth.data : undefined;
  const unauthenticated = auth?.status === 401;

  useEffect(() => {
    if (unauthenticated) router.replace(hrefOf('/login'));
  }, [unauthenticated, router, hrefOf]);

  if (isPending || unauthenticated) return null;
  if (isError || !me) {
    return (
      <GateBox role="alert">
        <p>관리자 정보를 확인하지 못했어요.</p>
        <button type="button" onClick={() => void refetch()}>
          다시 시도
        </button>
      </GateBox>
    );
  }
  if (me.role !== 'admin') {
    return (
      <GateBox role="alert">
        <p>관리자 계정으로만 접근할 수 있어요.</p>
        <button type="button" onClick={logout}>
          로그아웃
        </button>
      </GateBox>
    );
  }
  return <>{children}</>;
}

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <>
      {AdminGlobalStyles}
      <AdminAccessGate>
        <div style={{ display: 'flex', alignItems: 'stretch', width: '100%', minHeight: '100dvh' }}>
          <AdminSidebar />
          <main
            style={{
              minWidth: 0,
              flex: 1,
              padding: '80px 60px',
              display: 'flex',
              flexDirection: 'column',
              gap: 24,
              background: c.white,
            }}
          >
            {children}
          </main>
        </div>
      </AdminAccessGate>
    </>
  );
}

const GateBox = styled.div({
  minHeight: '100dvh',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 12,
  color: c.gray700,
});
const LogoutButton = styled.button({
  border: 0,
  background: 'transparent',
  color: c.gray500,
  ...textStyle.caption2,
  '&:hover': { color: c.gray900 },
});

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
const NavItem = styled(Link, { shouldForwardProp: (prop) => prop !== 'active' })<{
  active?: boolean;
}>(({ active }) => ({
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
const GearIcon = styled(Link)({
  display: 'inline-flex',
  marginLeft: 'auto',
  color: c.gray500,
  '&:hover': { color: c.gray900 },
});
