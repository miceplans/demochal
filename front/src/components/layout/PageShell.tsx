'use client';

import Link from 'next/link';
import styled from '@emotion/styled';
import type { ReactNode } from 'react';
import { textStyle } from '@/styles/typography';

const Shell = styled.div`
  width: 100%;
  max-width: 720px;
  margin: 0 auto;
  padding: 0 16px;
`;

const Header = styled.header`
  padding: 20px 0;
  border-bottom: 1px solid ${(p) => p.theme.colors.gray[100]};
`;

const Logo = styled.img`
  display: block;
  height: 28px;
  width: auto;
  object-fit: contain;
`;

const Container = styled.div`
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
  flex: 1;
  padding: 24px 0 48px;
`;

const Heading = styled.h1`
  font-size: ${textStyle.display.fontSize}px;
  font-weight: ${textStyle.display.fontWeight};
  color: ${(p) => p.theme.colors.gray[900]};
`;

interface PageShellProps {
  title?: string;
  children: ReactNode;
}

export function PageShell({ title, children }: PageShellProps) {
  return (
    <Shell>
      <Header>
        <Link href="/biz" aria-label="SEMOBIZ 홈">
          <Logo src="/assets/SEMOBIZ.png" alt="SEMOBIZ" width={110} height={28} />
        </Link>
      </Header>
      <Container>
        {title ? <Heading>{title}</Heading> : null}
        {children}
      </Container>
    </Shell>
  );
}
