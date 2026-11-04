'use client';

import type { HTMLAttributes } from 'react';
import styled from '@emotion/styled';
import { mask } from 'unveilmask';
import 'unveilmask/style.css';

interface MaskedTextProps extends HTMLAttributes<HTMLSpanElement> {
  /** 원문 값 — 마우스 호버(또는 키보드 포커스) 시 노출됩니다. */
  value: string;
  /** 마스킹된 표시 문자열. 생략하면 unveilmask가 값 형태에 맞게 마스킹합니다. */
  masked?: string;
}

// unveilmask의 .nm 구조로 렌더링해, style.css가 호버/포커스 시 원문(.nm-real)을 노출하게 한다.
export function MaskedText({ value, masked, ...rest }: MaskedTextProps) {
  const hiddenText = masked ?? mask(value);

  return (
    <Root
      className="nm"
      tabIndex={0}
      title="호버 또는 포커스 시 전체를 확인할 수 있습니다"
      aria-label={`${value} (가려진 값)`}
      {...rest}
    >
      <span className="nm-masked">{hiddenText}</span>
      <span className="nm-real">{value}</span>
    </Root>
  );
}

const Root = styled.span`
  &:focus-visible {
    outline: 2px solid ${(p) => p.theme.colors.semo};
    outline-offset: 2px;
    border-radius: 2px;
  }
`;
