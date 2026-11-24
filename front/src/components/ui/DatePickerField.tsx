'use client';

import { useEffect, useRef, useState } from 'react';
import styled from '@emotion/styled';
import { DayPicker } from 'react-day-picker';
import { ko } from 'react-day-picker/locale';
import 'react-day-picker/style.css';
import { Dropdown, type DropdownOption } from '@/components/ui/Dropdown';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { toDateKey } from '@/lib/date';

const HOURS: DropdownOption[] = Array.from({ length: 24 }, (_, h) => ({
  value: String(h).padStart(2, '0'),
  label: `${String(h).padStart(2, '0')}시`,
}));
const MINUTES: DropdownOption[] = Array.from({ length: 12 }, (_, i) => ({
  value: String(i * 5).padStart(2, '0'),
  label: `${String(i * 5).padStart(2, '0')}분`,
}));

/** 날짜(선택 시 시각까지) 입력. 값은 `YYYY-MM-DD` 또는 `YYYY-MM-DDTHH:mm`(비어 있으면 ''). */
export function DatePickerField({
  value,
  onChange,
  withTime = false,
  defaultTime = '00:00',
  invalid = false,
  minDate,
  size = 'S',
  'aria-label': ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  withTime?: boolean;
  defaultTime?: string;
  invalid?: boolean;
  /** 이 날짜(`YYYY-MM-DD`) 이전은 선택할 수 없다. */
  minDate?: string;
  /** S = 공고 폼(32px), L = Dropdown size L과 같은 44px 높이. */
  size?: 'S' | 'L';
  'aria-label': string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const datePart = value.slice(0, 10);
  const timePart = value.length > 10 ? value.slice(11, 16) : defaultTime;
  const [hour = '00', minute = '00'] = timePart.split(':');
  const selected = datePart ? new Date(`${datePart}T00:00:00`) : undefined;
  const [viewMonth, setViewMonth] = useState<Date>(() => selected ?? new Date());

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const emit = (date: string, time: string) => onChange(withTime ? `${date}T${time}` : date);
  const label = datePart
    ? `${datePart.replaceAll('-', '.')}${withTime ? ` ${hour}:${minute}` : ''}`
    : '날짜 선택';

  return (
    <PickerRoot ref={rootRef}>
      <PickerTrigger
        type="button"
        aria-label={ariaLabel}
        aria-invalid={invalid}
        aria-expanded={open}
        hasValue={Boolean(datePart)}
        size={size}
        onClick={() => {
          if (!open) setViewMonth(selected ?? new Date());
          setOpen((v) => !v);
        }}
      >
        {label}
      </PickerTrigger>
      {open && (
        <PickerPopover role="dialog" aria-label={`${ariaLabel} 달력`}>
          <PickerDayPicker
            mode="single"
            locale={ko}
            disabled={minDate ? { before: new Date(`${minDate}T00:00:00`) } : undefined}
            navLayout="around"
            selected={selected}
            month={viewMonth}
            onMonthChange={setViewMonth}
            onSelect={(date) => {
              if (!date) return;
              emit(toDateKey(date), `${hour}:${minute}`);
              if (!withTime) setOpen(false);
            }}
          />
          {withTime && (
            <PickerTime>
              <Dropdown
                size="S"
                width={92}
                aria-label={`${ariaLabel} 시`}
                options={HOURS}
                value={hour}
                onChange={(h) => datePart && emit(datePart, `${h}:${minute}`)}
                disabled={!datePart}
              />
              <Dropdown
                size="S"
                width={92}
                aria-label={`${ariaLabel} 분`}
                options={MINUTES}
                value={MINUTES.some((m) => m.value === minute) ? minute : undefined}
                placeholder={`${minute}분`}
                onChange={(m) => datePart && emit(datePart, `${hour}:${m}`)}
                disabled={!datePart}
              />
              <PickerDone type="button" onClick={() => setOpen(false)}>
                확인
              </PickerDone>
            </PickerTime>
          )}
        </PickerPopover>
      )}
    </PickerRoot>
  );
}

const PickerRoot = styled.div({ position: 'relative', flex: 1, minWidth: 0 });
const PickerTrigger = styled('button', {
  shouldForwardProp: (prop) => prop !== 'hasValue' && prop !== 'size',
})<{
  hasValue: boolean;
  size: 'S' | 'L';
}>(({ hasValue, size }) => ({
  width: '100%',
  height: size === 'L' ? 44 : 32,
  border: `0.5px solid ${size === 'L' ? c.gray200 : c.gray300}`,
  borderRadius: 8,
  padding: '0 14px',
  background: c.white,
  color: hasValue ? c.gray900 : c.gray500,
  textAlign: 'left',
  cursor: 'pointer',
  ...(size === 'L' ? textStyle.body : {}),
  '&:hover, &[aria-expanded=true]': { borderColor: c.primary },
  '&[aria-invalid=true]': { borderColor: c.red },
}));
const PickerPopover = styled.div({
  position: 'absolute',
  zIndex: 30,
  top: 'calc(100% + 6px)',
  left: 0,
  width: 'max-content',
  padding: 14,
  borderRadius: 10,
  background: c.white,
  border: `0.5px solid ${c.gray200}`,
  boxShadow: '0 12px 28px rgba(17, 24, 39, .18)',
});
const PickerDayPicker = styled(DayPicker)({
  '--rdp-accent-color': c.primary,
  '--rdp-accent-background-color': c.lightBlue,
  '--rdp-today-color': c.primary,
  '--rdp-day-width': '34px',
  '--rdp-day-height': '34px',
  '--rdp-day_button-width': '32px',
  '--rdp-day_button-height': '32px',
  '--rdp-day_button-border': 'none',
  '--rdp-selected-border': 'none',
  '--rdp-nav_button-width': '24px',
  '--rdp-nav_button-height': '24px',
  '--rdp-nav-height': '28px',
  '--rdp-weekday-opacity': 1,
  fontFamily: textStyle.metaText.fontFamily,
  '.rdp-month_caption': { ...textStyle.subtitle, color: c.gray900, justifyContent: 'center' },
  '.rdp-weekday': { ...textStyle.label, color: c.gray500 },
  '.rdp-day_button': { ...textStyle.metaText, color: c.gray900 },
  // 단일 선택은 기본 스타일에 배경이 없어, 테두리를 없앤 만큼 파란 원 배경을 직접 입힌다.
  '.rdp-selected': { fontSize: 'inherit', fontWeight: 600 },
  '.rdp-selected .rdp-day_button': { background: c.primary, color: c.white },
  '.rdp-today:not(.rdp-selected):not(.rdp-outside) .rdp-day_button': { fontWeight: 700 },
  '.rdp-chevron': { fill: c.gray700 },
});
const PickerTime = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginTop: 10,
  paddingTop: 10,
  borderTop: `0.5px solid ${c.gray200}`,
});
const PickerDone = styled.button({
  marginLeft: 'auto',
  height: 36,
  padding: '0 14px',
  border: 0,
  borderRadius: 8,
  background: c.primary,
  color: c.white,
});
