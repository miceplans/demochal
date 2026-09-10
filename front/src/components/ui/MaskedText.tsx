'use client';

import { useState, type HTMLAttributes } from 'react';
import styled from '@emotion/styled';
import { maskAll } from '@/lib/mask';

interface MaskedTextProps extends HTMLAttributes<HTMLSpanElement> {
  /** 원문 값 — 마우스 호버(또는 키보드 포커스) 시 노출됩니다. */
  value: string;
  /** 마스킹된 표시 문자열. 생략하면 전체가 `*`로 가려집니다. */
  masked?: string;
}

const Root = styled.span`
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid ${(p) => p.theme.colors.semo};
    outline-offset: 2px;
    border-radius: 2px;
  }
`;

export function MaskedText({ value, masked, ...rest }: MaskedTextProps) {
  const [revealed, setRevealed] = useState(false);
  const hiddenText = masked ?? maskAll(value);

  return (
    <Root
      tabIndex={0}
      title={revealed ? undefined : '호버 또는 포커스 시 전체를 확인할 수 있습니다'}
      aria-label={`${value} (가려진 값)`}
      onMouseEnter={() => setRevealed(true)}
      onMouseLeave={() => setRevealed(false)}
      onFocus={() => setRevealed(true)}
      onBlur={() => setRevealed(false)}
      {...rest}
    >
      {revealed ? value : hiddenText}
    </Root>
  );
}
