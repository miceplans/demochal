'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styled from '@emotion/styled';
import { generated } from '@semochal/api-client';
import { colors as c, shadows as s, mobile } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { useToast } from '@/components/common/Toast';
import { BizGlobalStyles, Logo, PrimaryButton, useBizHref } from '@/components/biz/BizShell';

export function BizLoginPage() {
  const router = useRouter();
  const hrefOf = useBizHref();
  const toast = useToast();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedIdentifier = identifier.trim();
    if (!normalizedIdentifier || !password) {
      toast.error('이메일 또는 아이디와 비밀번호를 입력해주세요.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await generated.login(
        normalizedIdentifier.includes('@')
          ? { email: normalizedIdentifier, password }
          : { username: normalizedIdentifier, password },
      );
      if (response.status !== 200 || response.data.user?.role !== 'business') {
        if (response.status === 200) await generated.logout();
        throw new Error('business login failed');
      }
      router.replace(hrefOf('/dashboard'));
    } catch {
      toast.error('기업 계정의 이메일 또는 아이디와 비밀번호를 확인해주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Wrap>
      {BizGlobalStyles}
      <Card>
        <Header>
          <Logo size={31} />
          <Title>기업 로그인</Title>
        </Header>
        <Form onSubmit={onSubmit} noValidate>
          <Field>
            <Label htmlFor="biz-identifier">이메일 또는 아이디</Label>
            <Input
              id="biz-identifier"
              autoComplete="username"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
            />
          </Field>
          <Field>
            <Label htmlFor="biz-password">비밀번호</Label>
            <Input
              id="biz-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </Field>
          <SubmitButton type="submit" disabled={submitting}>
            {submitting ? '로그인 중...' : '로그인'}
          </SubmitButton>
        </Form>
        <SignupPrompt>
          아직 계정이 없나요? <SignupLink href={hrefOf('/signup')}>회원가입</SignupLink>
        </SignupPrompt>
      </Card>
    </Wrap>
  );
}

const Wrap = styled.div({
  minHeight: '100vh',
  display: 'flex',
  justifyContent: 'center',
  padding: '80px 120px',
  background: c.white,
  [mobile]: { padding: '40px 16px' },
});
const Card = styled.div({
  width: '100%',
  maxWidth: 426,
  display: 'flex',
  flexDirection: 'column',
  gap: 36,
});
const Header = styled.div({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 24,
});
const Title = styled.h1({ margin: 0, ...textStyle.h2_2, color: c.gray900 });
const Form = styled.form({ display: 'flex', flexDirection: 'column', gap: 24 });
const Field = styled.div({ display: 'flex', flexDirection: 'column', gap: 10 });
const Label = styled.label({ ...textStyle.mBodyText, color: c.gray900 });
const Input = styled.input({
  height: 44,
  border: `0.5px solid ${c.gray200}`,
  borderRadius: 8,
  padding: '0 14px',
  ...textStyle.mListText,
  color: c.gray900,
  '&:focus': { outline: 'none', boxShadow: s.focus },
});
const SubmitButton = styled(PrimaryButton)({ height: 44, ...textStyle.mFeatureTitle });
const SignupPrompt = styled.p({
  margin: 0,
  textAlign: 'center',
  ...textStyle.mInfoText,
  color: c.gray700,
});
const SignupLink = styled(Link)({
  color: c.primary,
  textDecoration: 'underline',
  textUnderlineOffset: 3,
});
