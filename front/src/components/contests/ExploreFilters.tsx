'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import styled from '@emotion/styled';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';

/** Figma 탐색 필터 사이드바(FilterSidebar) 구성 요소 — 그룹 제목 + 칩/체크박스. */
export function FilterGroup({
  title,
  children,
  fit = false,
}: {
  title: string;
  children: React.ReactNode;
  /** true면 내용 폭만큼만 차지한다(가로 패널용). */
  fit?: boolean;
}) {
  return (
    <Group $fit={fit}>
      <GroupTitle>{title}</GroupTitle>
      {children}
    </Group>
  );
}

export function ChipFilter({
  options,
  selected,
  onToggle,
  ariaLabel,
  maxWidth,
}: {
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
  ariaLabel: string;
  maxWidth?: number;
}) {
  return (
    <Chips role="group" aria-label={ariaLabel} style={maxWidth ? { maxWidth } : undefined}>
      {options.map((option) => {
        const on = selected.includes(option);
        return (
          <ChipButton
            key={option}
            type="button"
            aria-pressed={on}
            $on={on}
            onClick={() => onToggle(option)}
          >
            {option}
          </ChipButton>
        );
      })}
    </Chips>
  );
}

export function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <CheckRow>
      <CheckInput type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </CheckRow>
  );
}

/** 옵션을 세로 `rows`개씩 채워 2열로 나누는 체크박스 목록(Figma 대상/주최기관 배치). */
export function CheckFilter({
  options,
  selected,
  onToggle,
  rows,
  columnGap,
}: {
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
  rows: number;
  columnGap: number;
}) {
  return (
    <CheckGrid $rows={rows} $columnGap={columnGap}>
      {options.map((option) => (
        <Checkbox
          key={option}
          label={option}
          checked={selected.includes(option)}
          onChange={() => onToggle(option)}
        />
      ))}
    </CheckGrid>
  );
}

/** 칩 모양 트리거 + 아래로 열리는 팝오버. 선택이 있으면 칩이 강조되고 개수를 보여준다. */
export function FilterPopover({
  label,
  count,
  children,
}: {
  label: string;
  count: number;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <PopoverWrap ref={ref}>
      <TriggerButton
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        $active={count > 0 || open}
        onClick={() => setOpen((v) => !v)}
      >
        {label}
        {count > 0 && <Count>{count}</Count>}
        <Caret aria-hidden $open={open} />
      </TriggerButton>
      {open && <PopoverPanel>{children}</PopoverPanel>}
    </PopoverWrap>
  );
}

export const toggleValue = (list: string[], value: string) =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

const Group = styled.div<{ $fit: boolean }>(({ $fit }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  width: $fit ? 'auto' : '100%',
}));
const GroupTitle = styled.h3({ ...textStyle.subtitle, color: c.gray900, margin: 0 });
const Chips = styled.div({ display: 'flex', flexWrap: 'wrap', gap: '4px 6px' });
const ChipButton = styled.button<{ $on: boolean }>(({ $on }) => ({
  ...textStyle[$on ? 'overline' : 'metaText'],
  padding: '5px 10px',
  borderRadius: 20,
  border: $on ? '0.5px solid transparent' : `0.5px solid ${c.gray300}`,
  background: $on ? c.primary : c.white,
  color: $on ? c.white : c.gray700,
  cursor: 'pointer',
  // 선택 토글이 뚝 끊기지 않도록 Primitives Chip과 같은 전환을 적용한다.
  transition: 'background 0.15s ease, color 0.15s ease, border-color 0.15s ease',
  '&:hover': { background: $on ? c.primary : c.gray50 },
}));
const CheckGrid = styled.div<{ $rows: number; $columnGap: number }>(({ $rows, $columnGap }) => ({
  display: 'grid',
  gridAutoFlow: 'column',
  gridTemplateRows: `repeat(${$rows}, auto)`,
  gridAutoColumns: 'max-content',
  gap: `10px ${$columnGap}px`,
}));
const CheckRow = styled.label({
  ...textStyle.caption,
  color: c.gray700,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
});
const CheckInput = styled.input({
  appearance: 'none',
  flexShrink: 0,
  width: 16,
  height: 16,
  margin: 0,
  borderRadius: 3,
  border: `0.5px solid ${c.gray300}`,
  background: c.white,
  cursor: 'pointer',
  '&:checked': {
    background: `${c.primary} url(/assets/icons/biz-checkbox-check.svg) center / 16px 16px no-repeat`,
    borderColor: c.primary,
  },
  '&:focus-visible': { outline: `2px solid ${c.primary}`, outlineOffset: 2 },
});
const PopoverWrap = styled.div({ position: 'relative' });
const TriggerButton = styled.button<{ $active: boolean }>(({ $active }) => ({
  ...textStyle.caption,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  height: 36,
  padding: '0 14px',
  borderRadius: 20,
  border: `0.5px solid ${c.gray900}`,
  background: $active ? c.primary : c.gray100,
  color: $active ? c.white : c.gray700,
  cursor: 'pointer',
  transition: 'background 0.15s ease, border-color 0.15s ease, color 0.15s ease',
  '&:hover': { background: $active ? c.primary : c.gray200 },
}));
const Count = styled.span({
  ...textStyle.overline,
  minWidth: 18,
  height: 18,
  padding: '0 5px',
  boxSizing: 'border-box',
  borderRadius: 9,
  background: c.white,
  color: c.primary,
  textAlign: 'center',
  lineHeight: '18px',
});
const Caret = styled.span<{ $open: boolean }>(({ $open }) => ({
  width: 6,
  height: 6,
  borderRight: '1.5px solid currentColor',
  borderBottom: '1.5px solid currentColor',
  transform: $open ? 'translateY(1px) rotate(225deg)' : 'translateY(-2px) rotate(45deg)',
  transition: 'transform 0.15s ease',
}));
const PopoverPanel = styled.div({
  position: 'absolute',
  top: 'calc(100% + 8px)',
  left: 0,
  zIndex: 20,
  minWidth: 200,
  padding: 16,
  borderRadius: 12,
  border: `0.5px solid ${c.gray200}`,
  background: c.white,
  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
});
