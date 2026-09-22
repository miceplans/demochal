'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import styled from '@emotion/styled';
import { generated } from '@semochal/api-client';
import { PrimaryButton } from './BizShell';

export function BizAccessCover({ children }: { children: ReactNode }) {
  const { data: auth, isLoading } = generated.useGetMyAuthInfo({ query: { retry: false } });
  const isBiz = auth?.status === 200 && auth.data.role === 'business';

  return (
    <>
      {children}
      {!isLoading && !isBiz ? (
        <Cover>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/SEMOBIZ.png" alt="SEMO.BIZ" style={{ height: 26, width: 'auto' }} />
          <Link href="/biz/login">
            <PrimaryButton as="span" style={{ width: 130, textAlign: 'center' }}>
              회원가입 하기
            </PrimaryButton>
          </Link>
        </Cover>
      ) : null}
    </>
  );
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
