'use client';
import styled from '@emotion/styled';
import { colors as c } from '@/styles/design';

export type BadgeTone = 'blue' | 'green' | 'red' | 'gray';

export function badgeToneColors(tone: BadgeTone = 'gray') {
  return {
    background:
      tone === 'blue'
        ? c.lightBlue
        : tone === 'green'
          ? c.lightGreen
          : tone === 'red'
            ? c.lightRed
            : c.gray100,
    color:
      tone === 'blue' ? c.primary : tone === 'green' ? c.green : tone === 'red' ? c.red : c.gray700,
  };
}

/** Shared status/tag pill — tone -> background/text color. Wrap with `styled(Badge)` for typography or layout tweaks. */
export const Badge = styled.span<{ tone?: BadgeTone }>(({ tone }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '4px 8px',
  borderRadius: 4,
  ...badgeToneColors(tone),
}));
