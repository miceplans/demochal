'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styled from '@emotion/styled';
import { generated } from '@semochal/api-client';
import { colors as c, shadows as s, mobile } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { useToast } from '@/components/common/Toast';
import { MfaStep } from '@/features/auth/components/MfaStep';
import { BizGlobalStyles, Logo, PrimaryButton, useBizHref } from '@/components/biz/BizShell';
import type { MfaChallenge, MfaUser } from '@/features/auth/mfa-types';

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

export function BizLoginPage() {
  const router = useRouter();
  const hrefOf = useBizHref();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [challenge, setChallenge] = useState<MfaChallenge | null>(null);

  const enter = async (user: MfaUser) => {
    if (user.role !== 'business') {
      await generated.logout().catch(() => undefined);
      setChallenge(null);
      toast.error('기업 계정의 이메일과 비밀번호를 확인해주세요.');
      return;
    }
    router.replace(hrefOf('/dashboard'));
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedEmail = email.trim();
    if (!normalizedEmail || !password) {
      toast.error('이메일과 비밀번호를 입력해주세요.');
      return;
    }
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      toast.error('이메일을 확인해주세요.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await generated.login({ email: normalizedEmail, password });
      if (response.status !== 200) throw new Error('business login failed');
      if ('mfaToken' in response.data) {
        if (response.data.user.role !== 'business') throw new Error('business login failed');
        setChallenge(response.data);
        return;
      }
      if (response.data.user?.role !== 'business') {
        await generated.logout();
        throw new Error('business login failed');
      }
      router.replace(hrefOf('/dashboard'));
    } catch {
      toast.error('기업 계정의 이메일과 비밀번호를 확인해주세요.');
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
        {challenge ? (
          <MfaStep
            challenge={challenge}
            onAuthenticated={(user) => void enter(user)}
            onCancel={() => setChallenge(null)}
          />
        ) : (
          <Form onSubmit={onSubmit} noValidate>
            <Field>
              <Label htmlFor="biz-email">이메일</Label>
              <Input
                id="biz-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
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
        )}
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
