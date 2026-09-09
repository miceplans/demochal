'use client';

import type { ReactNode } from 'react';
import styled from '@emotion/styled';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { Dropdown, type DropdownOption } from '@/components/ui/Dropdown';

export const AdminPageTitle = styled.h1(textStyle.h1_2);
export const AdminSectionTitle = styled.h2(textStyle.h1_2);

export const SectionHeader = styled.div({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
});
export const MoreLink = styled.a({
  ...textStyle.caption,
  color: c.gray500,
  textDecoration: 'none',
  cursor: 'pointer',
});

/* ---------- Stat Card ---------- */

const StatBox = styled.div({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: 18,
  border: '1px solid #E5E7EB',
  borderRadius: 16,
  minWidth: 0,
  flex: 1,
  background: c.white,
});
const StatLabel = styled.span({ ...textStyle.subtitle, color: '#6B7280' });
const StatValue = styled.strong({ ...textStyle.h1_2, color: '#111827' });
const StatMeta = styled.span({ ...textStyle.metaText, color: '#6B7280' });
const StatDot = styled.span<{ color: string }>(({ color }) => ({
  width: 9,
  height: 9,
  borderRadius: '50%',
  background: color,
  flexShrink: 0,
}));

export function StatCard({
  label,
  value,
  meta,
  dot,
}: {
  label: string;
  value: string;
  meta: string;
  dot?: string;
}) {
  return (
    <StatBox>
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <StatLabel>{label}</StatLabel>
        {dot ? <StatDot color={dot} /> : null}
      </span>
      <StatValue>{value}</StatValue>
      <StatMeta>{meta}</StatMeta>
    </StatBox>
  );
}

export const StatRow = styled.div({ display: 'flex', gap: 16, alignItems: 'stretch' });

/* ---------- Filter Bar ---------- */

export const FilterBar = styled.div({
  display: 'flex',
  gap: 24,
  flexWrap: 'wrap',
});

const SearchBox = styled.label({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: 360,
  height: 42,
  padding: '0 14px',
  border: '1px solid #E5E7EB',
  borderRadius: 10,
  background: c.white,
  '&:focus-within': { borderColor: c.primary },
});
const SearchInput = styled.input({
  flex: 1,
  minWidth: 0,
  border: 0,
  outline: 'none',
  background: 'transparent',
  ...textStyle.body,
  '&::placeholder': { color: '#6B7280' },
});
const SearchGlyph = styled.span({ display: 'inline-flex', color: c.gray500 });

export function SearchFilter({ placeholder, label, value, onChange }: { placeholder: string; label: string; value?: string; onChange?: (value: string) => void }) {
  return (
    <SearchBox>
      <SearchInput type="search" placeholder={placeholder} aria-label={label} value={value} onChange={(event) => onChange?.(event.target.value)} />
      <SearchGlyph aria-hidden>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
      </SearchGlyph>
    </SearchBox>
  );
}

export function SelectFilter({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value?: string;
  onChange?: (value: string) => void;
}) {
  const dropdownOptions: DropdownOption[] = options.map((option) => ({ value: option, label: option }));
  return (
    <Dropdown
      options={dropdownOptions}
      value={value}
      placeholder={label}
      aria-label={label}
      width={160}
      onChange={onChange}
    />
  );
}

/* ---------- Table ---------- */

export type AdminColumn<T> = {
  key: string;
  header: string;
  width?: number;
  render?: (row: T) => ReactNode;
};

const TableBox = styled.div({
  border: '1px solid #DFE2E7',
  borderRadius: 8,
  overflow: 'hidden',
  background: c.white,
});
const HeadRow = styled.div({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 40,
  padding: '14px 16px',
  background: c.gray100,
  ...textStyle.h3_2,
  color: c.gray900,
});
const BodyRow = styled.div<{ last?: boolean; clickable?: boolean; selected?: boolean }>(({ last, clickable, selected }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 40,
  height: 56,
  padding: '0 16px',
  background: selected ? '#EFF6FF' : c.white,
  borderTop: '1px solid #DFE2E7',
  borderRadius: last ? '0 0 8px 8px' : undefined,
  ...textStyle.bodyLarge,
  color: c.gray900,
  cursor: clickable ? 'pointer' : undefined,
  transition: clickable ? 'background-color 160ms ease' : undefined,
  '&:hover': clickable ? { background: selected ? '#DBEAFE' : c.gray50 } : undefined,
}));
const Cell = styled('span', { shouldForwardProp: (prop) => prop !== 'width' })<{ width?: number }>(({ width }) => ({
  width,
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  color: 'inherit',
}));

export function AdminTable<T extends { id: string }>({
  columns,
  rows,
  onRowClick,
  selectedRowId,
}: {
  columns: AdminColumn<T>[];
  rows: T[];
  onRowClick?: (row: T) => void;
  selectedRowId?: string | null;
}) {
  return (
    <TableBox role="table">
      <HeadRow role="row">
        {columns.map((column) => (
          <Cell key={column.key} width={column.width} role="columnheader">
            {column.header}
          </Cell>
        ))}
      </HeadRow>
      {rows.map((row, index) => (
        <BodyRow
          key={row.id}
          last={index === rows.length - 1 ? true : undefined}
          clickable={Boolean(onRowClick) || undefined}
          selected={selectedRowId === row.id || undefined}
          role="row"
          tabIndex={onRowClick ? 0 : undefined}
          aria-selected={onRowClick ? selectedRowId === row.id : undefined}
          onClick={onRowClick ? () => onRowClick(row) : undefined}
          onKeyDown={
            onRowClick
              ? (event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onRowClick(row);
                  }
                }
              : undefined
          }
        >
          {columns.map((column) => (
            <Cell key={column.key} width={column.width} role="cell">
              {column.render ? column.render(row) : String(row[column.key as keyof T])}
            </Cell>
          ))}
        </BodyRow>
      ))}
    </TableBox>
  );
}

/* ---------- Badge / Buttons ---------- */

export type BadgeTone = 'blue' | 'green' | 'red' | 'gray';
export const Badge = styled.span<{ tone: BadgeTone }>(({ tone }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 4,
  padding: '4px 8px',
  borderRadius: 4,
  whiteSpace: 'nowrap',
  ...textStyle.overline,
  background:
    tone === 'blue' ? c.lightBlue : tone === 'green' ? c.lightGreen : tone === 'red' ? c.lightRed : c.gray100,
  color: tone === 'blue' ? c.primary : tone === 'green' ? c.green : tone === 'red' ? c.red : c.gray700,
}));

export const ApproveButton = styled.button({
  border: 0,
  borderRadius: 6,
  background: c.primary,
  color: c.white,
  ...textStyle.subtitle,
  padding: '8px 16px',
  '&:hover': { background: '#0056c2' },
});
export const RejectButton = styled.button({
  border: `1px solid ${c.gray200}`,
  borderRadius: 6,
  background: c.white,
  color: c.gray900,
  ...textStyle.subtitle,
  padding: '8px 16px',
  '&:hover': { background: c.gray50 },
});

export const FieldLabel = styled.span({ ...textStyle.subtitle, color: c.gray700 });
