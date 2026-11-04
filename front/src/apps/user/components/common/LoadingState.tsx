'use client';

import styled from '@emotion/styled';
import { keyframes } from '@emotion/react';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';

const spin = keyframes({ to: { transform: 'rotate(360deg)' } });

const Wrap = styled.div<{ $compact: boolean }>(({ $compact }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
  padding: $compact ? '0' : '48px 0',
  color: c.gray500,
  ...textStyle.body,
}));

const Spinner = styled.span({
  width: 18,
  height: 18,
  flexShrink: 0,
  border: `2px solid ${c.gray200}`,
  borderTopColor: c.primary,
  borderRadius: '50%',
  animation: `${spin} 0.8s linear infinite`,
  '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
});

/** 데이터 로딩 중 공통 표시. label은 접근성 이름이자 화면 문구다. compact는 표 행처럼 높이가 정해진 곳에서 쓴다. */
export function LoadingState({ label, compact = false }: { label: string; compact?: boolean }) {
  return (
    <Wrap role="status" $compact={compact}>
      <Spinner aria-hidden />
      <span>{label}</span>
    </Wrap>
  );
}
