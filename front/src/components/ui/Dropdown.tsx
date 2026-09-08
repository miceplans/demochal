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
  disabled?: boolean;
  onChange?: (value: string) => void;
  style?: CSSProperties;
  'aria-label'?: string;
}

const Wrapper = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 9px;
  width: 100%;
`;

const Trigger = styled.button<{ $size: DropdownSize }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  padding: ${({ $size }) => ($size === 'L' ? '0 14px' : '6px 14px')};
  ${({ $size }) => $size === 'L' && 'height: 44px;'}
  background: ${(p) => p.theme.colors.background};
  border: 0.5px solid #e0e0e0;
  border-radius: 8px;
  font-family: inherit;
  font-size: ${textStyle.body.fontSize}px;
  font-weight: ${textStyle.body.fontWeight};
  color: #000;
  text-align: left;
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid ${(p) => p.theme.colors.foreground};
    outline-offset: -1px;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const Chevron = styled.img`
  flex-shrink: 0;
  object-fit: contain;
`;

const Listbox = styled.ul`
  display: flex;
  flex-direction: column;
  align-items: stretch;
  margin: 0;
  padding: 0;
  list-style: none;
`;

const Option = styled.li<{ $radius: string }>`
  padding: 12px 20px;
  background: ${(p) => p.theme.colors.background};
  box-shadow: 0 4px 4px 0 rgb(0 0 0 / 10%);
  border-radius: ${({ $radius }) => $radius};
  font-size: 13px;
  color: #111;
  cursor: pointer;

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
  disabled = false,
  onChange,
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
    <Wrapper ref={rootRef} onKeyDown={onKeyDown}>
      <Trigger
        type="button"
        $size={size}
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
        <Chevron src="/figma-assets/chevron-down.svg" alt="" width={24} height={24} />
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
              onMouseDown={(event) => event.preventDefault()}
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
