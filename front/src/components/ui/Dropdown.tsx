'use client';

import styled from '@emotion/styled';
import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { textStyle } from '@/styles/typography';

export interface DropdownOption {
  value: string;
  label: string;
}

type DropdownSize = 'L' | 'S';

interface DropdownProps {
  options: DropdownOption[];
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  size?: DropdownSize;
  width?: number | string;
  disabled?: boolean;
  onChange?: (value: string) => void;
  style?: CSSProperties;
  'aria-label'?: string;
}

const Wrapper = styled.div<{ $width: string }>`
  position: relative;
  width: ${({ $width }) => $width};
`;

const Trigger = styled.button<{ $size: DropdownSize; $hasValue: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  padding: 0 14px;
  height: ${({ $size }) => ($size === 'L' ? '44px' : '36px')};
  background: ${(p) => p.theme.colors.background};
  border: 0.5px solid #e0e0e0;
  border-radius: 8px;
  font-family: inherit;
  font-size: ${textStyle.body.fontSize}px;
  font-weight: ${textStyle.body.fontWeight};
  color: ${({ $hasValue, theme }) => ($hasValue ? '#111' : theme.colors.gray[500])};
  text-align: left;
  cursor: pointer;
  transition: box-shadow 0.15s ease, transform 0.1s ease;

  &:active:not(:disabled) {
    transform: scale(0.98);
  }

  &:focus-visible {
    outline: 2px solid ${(p) => p.theme.colors.foreground};
    outline-offset: -1px;
    box-shadow: ${(p) => p.theme.shadow.focus};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const Chevron = styled.span<{ $open: boolean }>`
  width: 8px;
  height: 8px;
  flex-shrink: 0;
  border-right: 1.5px solid currentColor;
  border-bottom: 1.5px solid currentColor;
  transform: rotate(${(p) => (p.$open ? '-135deg' : '45deg')}) translateY(${(p) => (p.$open ? '2px' : '-2px')});
  transition: transform 0.18s ease;
`;

const Listbox = styled.ul`
  position: absolute;
  top: calc(100% + 9px);
  left: 0;
  right: 0;
  z-index: 30;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  margin: 0;
  padding: 0;
  list-style: none;
  transform-origin: top center;
  animation: semo-listbox-in 0.16s ease-out;
  @keyframes semo-listbox-in {
    from {
      opacity: 0;
      transform: translateY(-6px) scale(0.98);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }
`;

const Option = styled.li<{ $radius: string; $active: boolean }>`
  display: flex;
  align-items: center;
  padding: 12px 20px;
  background: ${(p) => (p.$active ? p.theme.colors.gray[100] : p.theme.colors.background)};
  box-shadow: 0 4px 2px rgb(0 0 0 / 10%);
  border-radius: ${({ $radius }) => $radius};
  font-size: ${textStyle.caption.fontSize}px;
  font-weight: ${textStyle.caption.fontWeight};
  line-height: normal;
  color: #111;
  white-space: nowrap;
  cursor: pointer;
  transition: background 0.12s ease;

  &:hover {
    background: ${(p) => p.theme.colors.gray[100]};
  }
`;

export function Dropdown({
  options,
  value,
  defaultValue = '',
  placeholder = '요소를 선택하세요',
  size = 'L',
  width = '100%',
  disabled = false,
  onChange,
  style,
  'aria-label': ariaLabel,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const [internalValue, setInternalValue] = useState(defaultValue);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const selectedValue = value !== undefined ? value : internalValue;
  const selectedIndex = options.findIndex((option) => option.value === selectedValue);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [open]);

  const openListbox = () => {
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  };

  const select = (index: number) => {
    const option = options[index];
    if (!option) return;
    setInternalValue(option.value);
    setOpen(false);
    onChange?.(option.value);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    switch (event.key) {
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (open) select(activeIndex);
        else openListbox();
        break;
      case 'ArrowDown':
        event.preventDefault();
        if (!open) openListbox();
        else setActiveIndex((i) => Math.min(i + 1, options.length - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (open) setActiveIndex((i) => Math.max(i - 1, 0));
        break;
      case 'Home':
        if (open) setActiveIndex(0);
        break;
      case 'End':
        if (open) setActiveIndex(Math.max(options.length - 1, 0));
        break;
      case 'Escape':
        if (open) setOpen(false);
        break;
      case 'Tab':
        setOpen(false);
        break;
    }
  };

  const radiusFor = (index: number) => {
    if (options.length === 1) return '8px';
    if (index === 0) return '8px 8px 0 0';
    if (index === options.length - 1) return '0 0 8px 8px';
    return '0';
  };

  return (
    <Wrapper
      ref={rootRef}
      onKeyDown={onKeyDown}
      style={style}
      $width={typeof width === 'number' ? `${width}px` : width}
    >
      <Trigger
        type="button"
        $size={size}
        $hasValue={Boolean(selected)}
        disabled={disabled}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={open ? `${listboxId}-option-${activeIndex}` : undefined}
        aria-label={ariaLabel}
        onClick={() => (open ? setOpen(false) : openListbox())}
      >
        {selected ? selected.label : placeholder}
        <Chevron aria-hidden="true" $open={open} />
      </Trigger>
      {open && options.length > 0 ? (
        <Listbox id={listboxId} role="listbox" aria-label={ariaLabel}>
          {options.map((option, index) => (
            <Option
              key={option.value}
              id={`${listboxId}-option-${index}`}
              role="option"
              aria-selected={option.value === selectedValue}
              $radius={radiusFor(index)}
              $active={index === activeIndex}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => select(index)}
            >
              {option.label}
            </Option>
          ))}
        </Listbox>
      ) : null}
    </Wrapper>
  );
}
