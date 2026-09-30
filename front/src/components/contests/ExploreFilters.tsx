'use client';
import styled from '@emotion/styled';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';

/** Figma 탐색 필터 사이드바(FilterSidebar) 구성 요소 — 그룹 제목 + 칩/체크박스. */
export function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Group>
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
}: {
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
  ariaLabel: string;
}) {
  return (
    <Chips role="group" aria-label={ariaLabel}>
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

export const toggleValue = (list: string[], value: string) =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

const Group = styled.div({ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' });
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
