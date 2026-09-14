'use client';

import styled from '@emotion/styled';
import type { ButtonHTMLAttributes } from 'react';
import { textStyle } from '@/styles/typography';

type Variant = 'primary' | 'secondary' | 'ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  fullWidth?: boolean;
}

const StyledButton = styled.button<ButtonProps>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 16px;
  border-radius: 8px;
  border: none;
  font-size: ${textStyle.buttonLabel.fontSize}px;
  font-weight: ${textStyle.buttonLabel.fontWeight};
  cursor: pointer;
  transition:
    background 0.15s ease,
    opacity 0.15s ease,
    transform 0.1s ease,
    box-shadow 0.15s ease;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &:active:not(:disabled) {
    transform: scale(0.96);
  }

  ${(p) => p.variant === 'primary' && `background: ${p.theme.colors.semo}; color: ${p.theme.colors.background};`}
  ${(p) =>
    p.variant === 'secondary' &&
    `background: ${p.theme.colors.lightBlue}; color: ${p.theme.colors.semo};`}
  ${(p) => p.variant === 'ghost' && `background: transparent; color: ${p.theme.colors.gray[700]};`}

  ${(p) => p.fullWidth && 'width: 100%;'}
`;

export function Button({ variant = 'primary', fullWidth, ...rest }: ButtonProps) {
  return <StyledButton variant={variant} fullWidth={fullWidth} {...rest} />;
}
