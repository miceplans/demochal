'use client';

import styled from '@emotion/styled';
import { colors as c } from '@/styles/design';
import { LoginForm } from '@/features/auth/components/LoginForm';

const Card = styled.div`
  width: 100%;
  max-width: 400px;
  padding: 32px 24px;
  border: 1px solid ${c.gray200};
  border-radius: 16px;
  background: ${c.white};
  display: flex;
  flex-direction: column;
  gap: 24px;
`;

const Title = styled.h1`
  font-size: 20px;
  font-weight: 600;
  text-align: center;
`;

export function LoginCard() {
  return (
    <Card>
      <Title>로그인</Title>
      <LoginForm />
    </Card>
  );
}
