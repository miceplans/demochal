'use client';

import { Fragment } from 'react';
import styled from '@emotion/styled';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';

type StepState = 'done' | 'current' | 'todo';

export interface StepProgressBarProps {
  steps: string[];
  currentStep: number;
  'aria-label'?: string;
}

const DOT_SIZE = 32;

export function StepProgressBar({ steps, currentStep, ...rest }: StepProgressBarProps) {
  return (
    <List aria-label={rest['aria-label']}>
      {steps.map((label, i) => {
        const state: StepState = i < currentStep ? 'done' : i === currentStep ? 'current' : 'todo';
        return (
          <Fragment key={label}>
            {/* i번 바는 step i-1~i 구간. 이전 스텝이 완료(i <= currentStep)되면 채워진다. */}
            {i > 0 && <Bar $done={i <= currentStep} aria-hidden />}
            <Step>
              <Dot state={state}>
                {state === 'done' ? <Check src="/assets/icons/check.svg" alt="" /> : i + 1}
              </Dot>
              <Label state={state}>{label}</Label>
            </Step>
          </Fragment>
        );
      })}
    </List>
  );
}

const List = styled.ol({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  padding: '0 11px',
  margin: 0,
  listStyle: 'none',
});
// 미완료 회색 바 위에 완료 구간을 primary로 좌→우 채운다(fill 오버레이의 scaleX 전환).
const Bar = styled.li<{ $done?: boolean }>(({ $done }) => ({
  flex: 1,
  height: 1.5,
  marginTop: DOT_SIZE / 2 - 0.75,
  background: c.gray200,
  position: 'relative',
  '&::after': {
    content: '""',
    position: 'absolute',
    inset: 0,
    background: c.primary,
    transformOrigin: 'left center',
    transform: $done ? 'scaleX(1)' : 'scaleX(0)',
    transition: 'transform 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
  },
  '@media (prefers-reduced-motion: reduce)': { '&::after': { transition: 'none' } },
}));
const Step = styled.li({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 3,
});
const Dot = styled.span<{ state: StepState }>(({ state }) => ({
  width: DOT_SIZE,
  height: DOT_SIZE,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  ...textStyle.mMicroTag,
  background: state === 'done' ? c.primary : state === 'todo' ? c.gray50 : c.white,
  border: `1.5px solid ${state === 'todo' ? c.gray200 : c.primary}`,
  color: state === 'current' ? c.primary : c.gray700,
  transition: 'background 0.2s ease, border-color 0.2s ease, color 0.2s ease',
}));
// 완료 시 숫자가 체크로 바뀌는 전환을 팝으로 강조한다(Check는 done이 될 때만 마운트).
const Check = styled.img({
  width: 17.5,
  height: 17.5,
  animation: 'semo-step-check-pop 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
  '@keyframes semo-step-check-pop': {
    from: { transform: 'scale(0.4)', opacity: 0 },
    to: { transform: 'scale(1)', opacity: 1 },
  },
  '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
});
const Label = styled.span<{ state: StepState }>(({ state }) => ({
  ...textStyle.mMicroTag,
  color: state === 'current' ? c.primary : c.gray700,
}));
