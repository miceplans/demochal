'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react';
import styled from '@emotion/styled';
import { colors as c } from '@/styles/design';

/* 가로로 스크롤되는 영역: 스크롤바 대신 좌/우 화살표 버튼으로 더 보이는 화면으로 이동한다.
   스크롤할 내용이 없는 방향에는 버튼을 그리지 않는다. */

type Props<T extends ElementType> = {
  /** 실제로 가로 스크롤되는 요소(기존 styled 컴포넌트) */
  as?: T;
  children: ReactNode;
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'children'>;

export function ScrollRail<T extends ElementType = 'div'>({ as, children, ...rest }: Props<T>) {
  const Scroller: ElementType = as ?? 'div';
  const ref = useRef<HTMLElement | null>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 1);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    Array.from(el.children).forEach((child) => observer.observe(child));
    return () => observer.disconnect();
  }, [update, children]);

  const scrollByPage = (dir: -1 | 1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
  };

  return (
    <Wrap>
      <Scroller {...rest} ref={ref} onScroll={update}>
        {children}
      </Scroller>
      {canPrev && (
        <Arrow
          type="button"
          side="left"
          aria-label="이전 항목 보기"
          onClick={() => scrollByPage(-1)}
        >
          <Chevron direction="left" />
        </Arrow>
      )}
      {canNext && (
        <Arrow
          type="button"
          side="right"
          aria-label="다음 항목 보기"
          onClick={() => scrollByPage(1)}
        >
          <Chevron direction="right" />
        </Arrow>
      )}
    </Wrap>
  );
}

function Chevron({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d={direction === 'left' ? 'M10 3 5 8l5 5' : 'm6 3 5 5-5 5'}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const Wrap = styled.div({ position: 'relative', minWidth: 0 });

const Arrow = styled('button', { shouldForwardProp: (prop) => prop !== 'side' })<{
  side: 'left' | 'right';
}>(({ side }) => ({
  position: 'absolute',
  top: '50%',
  [side]: 8,
  transform: 'translateY(-50%)',
  zIndex: 2,
  width: 32,
  height: 32,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  borderRadius: '50%',
  border: `0.5px solid ${c.gray200}`,
  background: c.white,
  color: c.gray700,
  cursor: 'pointer',
  boxShadow: '0 2px 8px rgba(16, 16, 16, 0.12)',
  '&:hover': { color: c.gray900 },
}));
