'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import styled from '@emotion/styled';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { useToast } from '@/components/common/Toast';
import { generated } from '@semochal/api-client';
import { apiErrorMessage } from '@/lib/api-error';
import { MfaStep } from './MfaStep';
import { loginSchema, type LoginFormValues } from '../schema';
import type { MfaChallenge, MfaUser } from '../mfa-types';

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
`;

export function AdminLoginForm() {
  const router = useRouter();
  const toast = useToast();
  const [challenge, setChallenge] = useState<MfaChallenge | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  // 관리자 계정만 콘솔에 들어갈 수 있다. 아니면 발급된 세션 쿠키를 지운다.
  const enter = async (user: MfaUser) => {
    if (user.role !== 'admin') {
      await generated.logout().catch(() => undefined);
      setChallenge(null);
      toast.error('관리자 계정이 아닙니다.');
      return;
    }
    router.push('/admin');
  };

  const onSubmit = async (values: LoginFormValues) => {
    try {
      const response = await generated.login(values);
      if (response.status !== 200) throw new Error('admin login failed');
      if ('mfaToken' in response.data) {
        // 비관리자는 2FA 단계로 보내지 않는다(세션이 아직 없으므로 로그아웃도 불필요).
        if (response.data.user.role !== 'admin') {
          toast.error('관리자 계정이 아닙니다.');
          return;
        }
        setChallenge(response.data);
        return;
      }
      await enter(response.data.user);
    } catch (error) {
      toast.error(apiErrorMessage(error, '이메일 또는 비밀번호를 확인해 주세요.'));
    }
  };

  if (challenge) {
    return (
      <MfaStep
        challenge={challenge}
        onAuthenticated={(user) => void enter(user)}
        onCancel={() => setChallenge(null)}
      />
    );
  }

  return (
    <Form onSubmit={handleSubmit(onSubmit)} noValidate>
      <TextField
        label="이메일"
        type="email"
        autoComplete="email"
        error={errors.email?.message}
        {...register('email')}
      />
      <TextField
        label="비밀번호"
        type="password"
        placeholder="8자 이상"
        autoComplete="current-password"
        error={errors.password?.message}
        {...register('password')}
      />
      <Button type="submit" fullWidth disabled={isSubmitting}>
        {isSubmitting ? '로그인 중...' : '로그인'}
      </Button>
    </Form>
  );
}
