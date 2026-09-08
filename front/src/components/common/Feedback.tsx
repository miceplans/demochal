'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import styled from '@emotion/styled';
import { colors as c } from '@/styles/design';
const Dialog = styled.dialog({
  margin: 'auto',
  padding: 24,
  border: `1px solid ${c.gray100}`,
  borderRadius: 12,
  width: 360,
  maxWidth: 'calc(100vw - 32px)',
  color: c.gray900,
  '&::backdrop': { background: 'rgb(0 0 0 / .3)' },
});
export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
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
