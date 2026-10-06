'use client';
import styled from '@emotion/styled';
import { colors as c, shadows as s, mobile } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { Button as BaseButton } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
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
  imgCertificate: '/assets/icons/document.svg',
  imgToastSuccess: '/assets/icons/toast/check-icon.png',
  imgToastError: '/assets/icons/toast/close-icon.png',
  imgToastInfo: '/assets/icons/toast/info-icon.png',
  imgImage2: '/assets/oauth/kakao-logo.png',
  imgImage1: '/assets/oauth/google-logo.png',
  imgImage3: '/assets/oauth/naver-logo.png',
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
    border: `0.5px solid ${tone === 'plain' ? c.gray100 : c.primary}`,
    padding: small ? '6px 12px' : '12px 24px',
    background: tone === 'primary' ? c.primary : c.white,
    color: tone === 'primary' ? c.white : tone === 'outline' ? c.primary : c.gray700,
    fontSize: small ? textStyle.overline.fontSize : textStyle.buttonLabel.fontSize,
    fontWeight: 600,
    minHeight: small ? 28 : 44,
    '&:hover:not(:disabled)': { background: tone === 'primary' ? c.primaryHover : c.gray50 },
  }),
);
export const Input = styled.input({
  width: '100%',
  minWidth: 0,
  height: 44,
  border: `0.5px solid ${c.gray100}`,
  borderRadius: 8,
  padding: '0 14px',
  background: c.white,
  transition: 'box-shadow 0.15s ease, border-color 0.15s ease',
  '&:hover:not(:focus)': { borderColor: c.gray300 },
  '&::placeholder': { color: c.gray500 },
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
  border: `0.5px solid ${c.gray100}`,
  borderRadius: 12,
  background: c.white,
  padding: 24,
  [mobile]: { padding: 16 },
});
export const Chip = styled.button<{ selected?: boolean }>(({ selected }) => ({
  border: `0.5px solid ${selected ? c.primary : c.gray100}`,
  borderRadius: 24,
  background: selected ? c.primary : c.white,
  color: selected ? c.white : c.gray700,
  ...textStyle.caption,
  padding: '8px 16px',
  cursor: 'pointer',
  transition:
    'background 0.15s ease, color 0.15s ease, border-color 0.15s ease, transform 0.1s ease',
  '&:hover': { background: selected ? c.primary : c.gray50 },
  '&:active': { transform: 'scale(0.93)' },
}));
export const Tag = styled(Badge)({
  ...textStyle.finePrint,
  lineHeight: 1.25,
});
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
  cursor: 'pointer',
  transition: 'background 0.15s ease, transform 0.1s ease',
  '&:hover': { background: c.gray50 },
  '&:active': { transform: 'scale(0.85)' },
  '&:disabled': { cursor: 'not-allowed' },
});
export const EmptyArtwork = styled.div({ background: c.gray100, borderRadius: 12 });
// 콘텐츠가 없을 때 보여주는 빈 상태 일러스트. 안내 문구 없이 이미지만 표시한다.
export function EmptyState({ width = 280 }: { width?: number }) {
  return (
    <EmptyStateWrapper>
      <img
        src="/assets/empty-contents.png"
        alt=""
        width={800}
        height={533}
        style={{ width: '100%', maxWidth: width, height: 'auto', display: 'block' }}
      />
    </EmptyStateWrapper>
  );
}
const EmptyStateWrapper = styled.div({
  display: 'flex',
  justifyContent: 'center',
  width: '100%',
  padding: '40px 0',
  [mobile]: { padding: '24px 0' },
  // 빈 상태가 등장할 때 갑작스럽게 나타나지 않도록 페이드인한다.
  animation: 'semo-empty-in 0.25s ease-out both',
  '@keyframes semo-empty-in': {
    from: { opacity: 0 },
    to: { opacity: 1 },
  },
  '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
});
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
        transition: 'background 0.2s ease',
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
          transition: 'transform .2s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      />
    </button>
  );
}
