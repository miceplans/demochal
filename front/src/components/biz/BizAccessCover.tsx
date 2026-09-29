'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import styled from '@emotion/styled';
import { generated } from '@semochal/api-client';
import { PrimaryButton, useBizHref } from './BizShell';

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
        <Link href={hrefOf('/signup')}>
          <PrimaryButton as="span" style={{ width: 130, textAlign: 'center' }}>
            회원가입 하기
          </PrimaryButton>
        </Link>
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

const LoadingView = styled.div({
  position: 'fixed',
  inset: 0,
  zIndex: 50,
  background: '#ffffff',
});
