'use client';
import styled from '@emotion/styled';
import { colors as c, shadows as s, mobile } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { Button as BaseButton } from '@/components/ui/Button';
import type { ElementType, ReactNode } from 'react';

const ICON_SOURCES: Record<string, string> = {
  imgS1Del: '/assets/icons/delete.svg',
  imgAddSlotIc: '/assets/icons/add.svg',
  imgGithub: '/assets/icons/github.svg',
  imgDescription24DpE3E3E3Fill0Wght300Grad0Opsz241: '/assets/icons/document.svg',
  imgTrophy24DpE3E3E3Fill0Wght300Grad0Opsz241: '/assets/icons/trophy.svg',
  imgLink1Icon: '/assets/icons/github.svg',
  imgLink2Icon: '/assets/icons/link-external.svg',
  imgLink3Icon: '/assets/icons/document.svg',
  imgToastSuccess: '/assets/icons/toast-success.svg',
  imgToastError: '/assets/icons/toast-error.svg',
  imgToastInfo: '/assets/icons/toast-info.svg',
  imgImage2: '/assets/icons/kakao.svg',
  imgImage1: '/assets/icons/google.svg',
  imgImage3: '/assets/icons/naver.svg',
};
export function Icon({
  name,
  size = 20,
  width,
  height,
  alt = '',
  className,
  src,
}: {
  name?: string;
  size?: number;
  width?: number;
  height?: number;
  alt?: string;
  className?: string;
  src?: string;
}) {
  const iconSrc = src ?? (name ? ICON_SOURCES[name] : undefined);
  if (!iconSrc) return null;
  return (
    <img
      src={iconSrc}
      alt={alt}
      width={width ?? size}
      height={height ?? size}
      className={className}
      style={{ flexShrink: 0, objectFit: 'contain' }}
    />
  );
}
export const Button = styled(BaseButton, {
  shouldForwardProp: (prop) => !['tone', 'small'].includes(prop),
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
  '&:focus': { outline: 'none', boxShadow: s.focus },
});
export const Select = styled.select({
  minWidth: 0,
  height: 40,
  border: `1px solid ${c.gray100}`,
  borderRadius: 8,
  padding: '0 14px',
  background: c.white,
  color: c.gray700,
  '&:focus': { outline: 'none', boxShadow: s.focus },
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
export const Muted = styled.p({ ...textStyle.caption, color: c.gray500, lineHeight: 1.5 });
export const Title = styled.h1(textStyle.h1_2);
export const Heading = styled.h2({ ...textStyle.title, lineHeight: 1.4 });
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
  ...textStyle.caption,
  padding: '8px 16px',
}));
export const Tag = styled.span<{ tone?: 'blue' | 'green' | 'red' | 'gray' }>(
  ({ tone = 'gray' }) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    ...textStyle.finePrint,
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
