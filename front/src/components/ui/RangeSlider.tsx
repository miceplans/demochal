'use client';

import styled from '@emotion/styled';
import { colors as c } from '@/styles/design';

const THUMB_SIZE = 12;
const TRACK_HEIGHT = 20;

export interface RangeSliderProps {
  min: number;
  max: number;
  step?: number;
  value: [number, number];
  onChange: (value: [number, number]) => void;
  minAriaLabel?: string;
  maxAriaLabel?: string;
}

const Track = styled.div`
  position: relative;
  width: 100%;
  height: ${TRACK_HEIGHT}px;
`;

const Rail = styled.div`
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 4px;
  transform: translateY(-50%);
  border-radius: 100px;
  background: ${c.primary}33;
`;

const Fill = styled.div<{ $left: string; $width: string }>`
  position: absolute;
  top: 50%;
  height: 4px;
  transform: translateY(-50%);
  border-radius: 100px;
  background: ${c.primary};
  left: ${({ $left }) => $left};
  width: ${({ $width }) => $width};
`;

const ThumbInput = styled.input`
  position: absolute;
  inset: 0;
  width: 100%;
  height: ${TRACK_HEIGHT}px;
  margin: 0;
  background: transparent;
  pointer-events: none;
  -webkit-appearance: none;
  appearance: none;

  &::-webkit-slider-runnable-track {
    height: ${TRACK_HEIGHT}px;
    background: transparent;
  }
  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    pointer-events: auto;
    width: ${THUMB_SIZE}px;
    height: ${THUMB_SIZE}px;
    margin-top: ${(TRACK_HEIGHT - THUMB_SIZE) / 2}px;
    border-radius: 50%;
    background: ${c.white};
    border: 0;
    box-shadow: none;
    cursor: pointer;
    transition:
      background 0.15s ease,
      box-shadow 0.15s ease;

    &:active {
      background: ${c.primary};
      box-shadow:
        0 0 0 4px ${c.primary}40,
        0 2px 8px ${c.primary}66;
    }
  }
  &::-moz-range-track {
    height: ${TRACK_HEIGHT}px;
    background: transparent;
  }
  &::-moz-range-thumb {
    pointer-events: auto;
    width: ${THUMB_SIZE}px;
    height: ${THUMB_SIZE}px;
    border-radius: 50%;
    background: ${c.white};
    border: 0;
    box-shadow: none;
    cursor: pointer;
    transition:
      background 0.15s ease,
      box-shadow 0.15s ease;

    &:active {
      background: ${c.primary};
      box-shadow:
        0 0 0 4px ${c.primary}40,
        0 2px 8px ${c.primary}66;
    }
  }
`;

export function RangeSlider({
  min,
  max,
  step = 1,
  value,
  onChange,
  minAriaLabel = '최솟값',
  maxAriaLabel = '최댓값',
}: RangeSliderProps) {
  const [from, to] = value;
  const snap = (v: number) => Math.max(min, Math.min(max, Math.round(v / step) * step));
  const pos = (v: number) => ((v - min) / (max - min)) * 100;
  const offset = (p: number) => THUMB_SIZE / 2 - (p / 100) * THUMB_SIZE;
  const fromPos = pos(from);
  const toPos = pos(to);
  return (
    <Track>
      <Rail />
      <Fill
        $left={`calc(${fromPos}% + ${offset(fromPos)}px)`}
        $width={`calc(${toPos - fromPos}% - ${((toPos - fromPos) / 100) * THUMB_SIZE}px)`}
      />
      <ThumbInput
        type="range"
        aria-label={minAriaLabel}
        min={min}
        max={max}
        step={step}
        value={from}
        onChange={(e) => onChange([Math.min(snap(Number(e.target.value)), to), to])}
      />
      <ThumbInput
        type="range"
        aria-label={maxAriaLabel}
        min={min}
        max={max}
        step={step}
        value={to}
        onChange={(e) => onChange([from, Math.max(snap(Number(e.target.value)), from)])}
        style={{ zIndex: 2 }}
      />
    </Track>
  );
}
