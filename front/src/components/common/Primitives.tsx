'use client';
import styled from '@emotion/styled';
import { colors as c, mobile } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import assets from '@/data/figma-assets.json';
import { Button as BaseButton } from '@/components/ui/Button';
import type { ElementType, ReactNode } from 'react';

export function asset(frame: string, name: string): string {
  const entries = (assets as Record<string, Record<string, string>>)[frame];
  if (!entries?.[name]) throw new Error(`Missing Figma asset: ${frame}/${name}`);
  return entries[name];
}
export function Icon({
  name,
  frame = '195-959',
  size = 20,
  width,
  height,
  alt = '',
  className,
}: {
  name: string;
  frame?: string;
  size?: number;
  width?: number;
  height?: number;
  alt?: string;
  className?: string;
}) {
  return (
    <img
      src={asset(frame, name)}
      alt={alt}
      width={width ?? size}
      height={height ?? size}
      className={className}
      style={{ flexShrink: 0, objectFit: 'contain' }}
    />
  );
}
export const Button = styled(BaseButton, {
  shouldForwardProp: (prop) => !['tone', 'small', 'variant', 'fullWidth'].includes(prop),
})<{ tone?: 'primary' | 'outline' | 'plain'; small?: boolean; as?: ElementType }>(
  ({ tone = 'primary', small }) => ({
    borderRadius: 8,
    border: `1px solid ${tone === 'plain' ? c.gray100 : c.primary}`,
    padding: small ? '6px 12px' : '12px 24px',
    background: tone === 'primary' ? c.primary : c.white,
    color: tone === 'primary' ? c.white : tone === 'outline' ? c.primary : c.gray700,
    fontSize: small ? textStyle.overline.fontSize : textStyle.buttonLabel.fontSize,
    fontWeight: 600,
    minHeight: small ? 28 : 44,
    '&:hover:not(:disabled)': { background: tone === 'primary' ? '#005ee0' : c.gray50 },
  }),
);
export const Input = styled.input({
  width: '100%',
  minWidth: 0,
  height: 44,
  border: `1px solid ${c.gray100}`,
  borderRadius: 8,
  padding: '0 14px',
  background: c.white,
  '&::placeholder': { color: c.gray500 },
});
export const Select = styled.select({
  minWidth: 0,
  height: 40,
  border: `1px solid ${c.gray100}`,
  borderRadius: 8,
  padding: '0 14px',
  background: c.white,
  color: c.gray700,
});
export const Row = styled.div<{ gap?: number }>(({ gap = 12 }) => ({
  display: 'flex',
  alignItems: 'center',
  gap,
  minWidth: 0,
}));
export const Stack = styled.div<{ gap?: number }>(({ gap = 24 }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap,
  minWidth: 0,
}));
export const Wrap = styled.div({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 });
export const Muted = styled.p({ color: c.gray500, fontSize: 13, lineHeight: 1.5 });
export const Title = styled.h1({ fontSize: 20, lineHeight: 1.3 });
export const Heading = styled.h2({ fontSize: 16, lineHeight: 1.4 });
export const SectionHeading = styled.h2(textStyle.h2_2);
export const Panel = styled.section({
  border: `1px solid ${c.gray100}`,
  borderRadius: 12,
  background: c.white,
  padding: 24,
  [mobile]: { padding: 16 },
});
export const Chip = styled.button<{ selected?: boolean }>(({ selected }) => ({
  border: `1px solid ${selected ? c.primary : c.gray100}`,
  borderRadius: 24,
  background: selected ? c.primary : c.white,
  color: selected ? c.white : c.gray700,
  fontSize: 13,
  padding: '8px 16px',
}));
export const Tag = styled.span<{ tone?: 'blue' | 'green' | 'red' | 'gray' }>(
  ({ tone = 'gray' }) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 11,
    lineHeight: 1.25,
    borderRadius: 4,
    padding: '4px 8px',
    background:
      tone === 'blue'
        ? c.lightBlue
        : tone === 'green'
          ? c.lightGreen
          : tone === 'red'
            ? c.lightRed
            : c.gray100,
    color:
      tone === 'blue' ? c.primary : tone === 'green' ? c.green : tone === 'red' ? c.red : c.gray700,
  }),
);
export const DesktopOnly = styled.div({ [mobile]: { display: 'none !important' } });
export const MobileOnly = styled.div({ display: 'none', [mobile]: { display: 'block' } });
export const IconButton = styled.button({
  border: 0,
  background: 'transparent',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 4,
  borderRadius: 6,
});
export const EmptyArtwork = styled.div({ background: c.gray100, borderRadius: 12 });
export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <Row style={{ justifyContent: 'space-between' }}>
      <SectionHeading>{title}</SectionHeading>
      {action}
    </Row>
  );
}
export function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-label={label}
      aria-checked={checked}
      onClick={onChange}
      style={{
        width: 44,
        height: 24,
        padding: 2,
        border: 0,
        borderRadius: 20,
        background: checked ? c.primary : c.gray300,
        flexShrink: 0,
      }}
    >
      <span
        style={{
          display: 'block',
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: c.white,
          transform: checked ? 'translateX(20px)' : 'none',
          transition: 'transform .15s',
        }}
      />
    </button>
  );
}
