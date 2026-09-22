'use client';

import Image from 'next/image';
import styled from '@emotion/styled';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { AdminGlobalStyles } from '@/components/admin/AdminShell';
import { AdminLoginForm } from '@/features/auth/components/AdminLoginForm';

export function AdminLoginScreen() {
  return (
    <>
      {AdminGlobalStyles}
      <Container>
        <Panel>
          <Image src="/assets/SEMOADMIN.png" alt="세모챌 관리자" width={132} height={42} priority />
          <Heading>관리자 로그인</Heading>
          <AdminLoginForm />
        </Panel>
      </Container>
    </>
  );
}

const Container = styled.div({
  minHeight: '100dvh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '40px 16px',
  background: c.white,
});

const Panel = styled.div({
  width: 360,
  maxWidth: '100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch',
  gap: 24,
  padding: '40px 32px',
  borderRadius: 12,
  border: '1px solid #E5E7EB',
  background: c.white,
});

const Heading = styled.h1({
  ...textStyle.h2_2,
  color: '#111827',
  textAlign: 'center',
});
