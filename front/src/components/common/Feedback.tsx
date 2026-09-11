'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import styled from '@emotion/styled';
import { colors as c } from '@/styles/design';
const Dialog = styled.dialog<{ width: number }>(({ width }) => ({
  margin: 'auto',
  padding: 24,
  border: `1px solid ${c.gray100}`,
  borderRadius: 12,
  width,
  maxWidth: 'calc(100vw - 32px)',
  color: c.gray900,
  '&::backdrop': { background: 'rgb(0 0 0 / .3)', animation: 'semo-backdrop-in .2s ease-out' },
  '&[open]': { animation: 'semo-modal-in .22s cubic-bezier(0.22, 1, 0.36, 1)' },
  '@keyframes semo-modal-in': {
    from: { opacity: 0, transform: 'translateY(12px) scale(0.97)' },
    to: { opacity: 1, transform: 'none' },
  },
  '@keyframes semo-backdrop-in': {
    from: { opacity: 0 },
    to: { opacity: 1 },
  },
}));
export function Modal({
  open,
  onClose,
  title,
  width = 360,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  width?: number;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (open && d && !d.open) d.showModal();
    if (!open && d?.open) d.close();
  }, [open]);
  return (
    <Dialog
      ref={ref}
      width={width}
      aria-label={title}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h2 style={{ fontSize: 16 }}>{title}</h2>
        {children}
      </div>
    </Dialog>
  );
}
