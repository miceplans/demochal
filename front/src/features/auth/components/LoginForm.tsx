'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import styled from '@emotion/styled';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { api } from '@/lib/api';
import { loginSchema, type LoginFormValues } from '../schema';

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
`;

const SubmitError = styled.p`
  font-size: 13px;
  color: ${(p) => p.theme.colors.red};
`;

// React Hook Form + Zod example.
// Submit calls the shared api-client; auth flows themselves are TODO on the server.
export function LoginForm() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setSubmitError(null);
    try {
      const { accessToken } = await api.auth.login(values);
      window.localStorage.setItem('accessToken', accessToken);
      router.push('/my');
    } catch (err) {
      setSubmitError(
        err instanceof Error ? `로그인에 실패했습니다. (${err.message})` : '로그인에 실패했습니다.',
      );
    }
  };

  return (
    <Form onSubmit={handleSubmit(onSubmit)} noValidate>
      <TextField
        label="이메일"
        type="email"
        placeholder="example@semochal.kr"
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
      {submitError ? <SubmitError role="alert">{submitError}</SubmitError> : null}
      <Button type="submit" fullWidth disabled={isSubmitting}>
        {isSubmitting ? '로그인 중...' : '로그인'}
      </Button>
    </Form>
  );
}
