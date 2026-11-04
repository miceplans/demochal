'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import styled from '@emotion/styled';
import { generated } from '@semochal/api-client';
import { PrimaryButton, OutlineButton, useBizHref } from './BizShell';

export function BizAccessCover({ children }: { children: ReactNode }) {
  const hrefOf = useBizHref();
  const { data: auth, isLoading } = generated.useGetMyAuthInfo({ query: { retry: false } });
  const isBiz = auth?.status === 200 && auth.data.role === 'business';

  if (isLoading) {
    return <LoadingView aria-busy aria-label="접근 권한 확인 중" />;
  }

  if (!isBiz) {
    return (
      <Cover>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/SEMOBIZ.png" alt="SEMO.BIZ" style={{ height: 26, width: 'auto' }} />
        <CoverActions>
          <Link href={hrefOf('/login')}>
            <PrimaryButton as="span" style={{ width: 130, textAlign: 'center' }}>
              로그인
            </PrimaryButton>
          </Link>
          <Link href={hrefOf('/signup')}>
            <OutlineButton as="span" style={{ width: 130, textAlign: 'center' }}>
              회원가입 하기
            </OutlineButton>
          </Link>
        </CoverActions>
      </Cover>
    );
  }

  return <>{children}</>;
}

const Cover = styled.div({
  position: 'fixed',
  inset: 0,
  zIndex: 50,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 49,
  background: 'rgba(255,255,255,0.65)',
  backdropFilter: 'blur(3px)',
  WebkitBackdropFilter: 'blur(3px)',
});

const CoverActions = styled.div({
  display: 'flex',
  gap: 12,
});

const LoadingView = styled.div({
  position: 'fixed',
  inset: 0,
  zIndex: 50,
  background: '#ffffff',
});
