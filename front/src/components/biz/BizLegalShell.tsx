'use client';
import Link from 'next/link';
import type { ReactNode } from 'react';
import styled from '@emotion/styled';
import { colors as c } from '@/styles/design';
import { BizGlobalStyles, BizFooter, useBizHref } from '@/components/biz/BizShell';

export function BizLegalHeader() {
  const hrefOf = useBizHref();
  return (
    <HeaderBox>
      <Link href={hrefOf('/')} aria-label="SEMO.BIZ 홈">
        <img
          src="/assets/SEMOBIZ.png"
          alt="SEMO.BIZ"
          width={109}
          height={28}
          style={{ display: 'block', objectFit: 'contain' }}
        />
      </Link>
    </HeaderBox>
  );
}

export function BizLegalShell({ children }: { children: ReactNode }) {
  return (
    <>
      {BizGlobalStyles}
      <div
        style={{
          minWidth: 0,
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          background: c.white,
        }}
      >
        <BizLegalHeader />
        <main
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          {children}
        </main>
        <BizFooter />
      </div>
    </>
  );
}

const HeaderBox = styled.header({
  background: c.white,
  borderBottom: `0.5px solid ${c.gray100}`,
  padding: '14px max(24px, calc((100% - 1200px) / 2))',
});
