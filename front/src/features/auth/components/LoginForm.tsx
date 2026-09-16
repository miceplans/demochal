'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import styled from '@emotion/styled';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { adApi } from '@/lib/ad-api';
import { loginSchema, type LoginFormValues } from '../schema';

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
`;

export function LoginForm() {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (values: LoginFormValues) => {
    try {
      await adApi.auth.login(values);
      router.push('/my');
    } catch {
      setError('root', { message: '이메일 또는 비밀번호를 확인해 주세요.' });
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
      <Button type="submit" fullWidth disabled={isSubmitting}>
        {isSubmitting ? '로그인 중...' : '로그인'}
      </Button>
      {errors.root?.message && <p role="alert">{errors.root.message}</p>}
    </Form>
  );
}
