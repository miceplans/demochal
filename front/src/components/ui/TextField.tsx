'use client';

import styled from '@emotion/styled';
import { forwardRef, type InputHTMLAttributes } from 'react';

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

const Wrapper = styled.label`
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
`;

const Label = styled.span`
  font-size: 13px;
  font-weight: 600;
  color: ${(p) => p.theme.colors.gray[700]};
`;

const Input = styled.input<{ hasError?: boolean }>`
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid ${(p) => (p.hasError ? p.theme.colors.red : p.theme.colors.gray[200])};
  font-size: 15px;
  background: ${(p) => p.theme.colors.gray[50]};
  outline: none;

  &:focus {
    border-color: ${(p) => p.theme.colors.semo};
    box-shadow: ${(p) => p.theme.shadow.focus};
  }
`;

const ErrorText = styled.span`
  font-size: 12px;
  color: ${(p) => p.theme.colors.red};
`;

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, error, ...rest },
  ref,
) {
  return (
    <Wrapper>
      <Label>{label}</Label>
      <Input ref={ref} hasError={Boolean(error)} aria-invalid={Boolean(error)} {...rest} />
      {error ? <ErrorText role="alert">{error}</ErrorText> : null}
    </Wrapper>
  );
});
