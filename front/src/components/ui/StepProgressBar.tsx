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

const List = styled.ol({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  padding: '0 11px',
  margin: 0,
  listStyle: 'none',
});
const Bar = styled.li({
  flex: 1,
  height: 1.5,
  marginTop: DOT_SIZE / 2 - 0.75,
  background: c.gray200,
});
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
}));
const Check = styled.img({ width: 17.5, height: 17.5 });
const Label = styled.span<{ state: StepState }>(({ state }) => ({
  ...textStyle.mMicroTag,
  color: state === 'current' ? c.primary : c.gray700,
}));

export function StepProgressBar({ steps, currentStep, ...rest }: StepProgressBarProps) {
  return (
    <List aria-label={rest['aria-label']}>
      {steps.map((label, i) => {
        const state: StepState = i < currentStep ? 'done' : i === currentStep ? 'current' : 'todo';
        return (
          <Fragment key={label}>
            {i > 0 && <Bar aria-hidden />}
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
