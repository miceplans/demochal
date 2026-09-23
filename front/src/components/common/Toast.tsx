'use client';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import styled from '@emotion/styled';
import { Icon } from './Primitives';
import { colors as c, mobile } from '@/styles/design';
import { textStyle } from '@/styles/typography';

export type ToastVariant = 'success' | 'error' | 'info';
export type ToastAction = { label: string; onClick: () => void };
type ToastOptions = { action?: ToastAction };
type ToastItem = {
  id: number;
  variant: ToastVariant;
  message: string;
  description?: string;
  action?: ToastAction;
};
export type ToastApi = Record<
  ToastVariant,
  (message: string, description?: string, options?: ToastOptions) => void
>;

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const toast = useContext(ToastContext);
  if (!toast) throw new Error('useToast must be used within ToastProvider');
  return toast;
}

const iconNames: Record<ToastVariant, string> = {
  success: 'imgToastSuccess',
  error: 'imgToastError',
  info: 'imgToastInfo',
};
const backgrounds: Record<ToastVariant, string> = {
  success: `radial-gradient(circle at 0% 50%, #b9ffd2 0%, ${c.white} 29%)`,
  error: `linear-gradient(90deg, #ffe0d2 0%, ${c.white} 28%)`,
  info: `linear-gradient(90deg, #d1e5ff 0%, ${c.white} 32%)`,
};

const Viewport = styled.div({
  position: 'fixed',
  top: 16,
  right: 16,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-end',
  gap: 8,
  zIndex: 100,
  pointerEvents: 'none',
  [mobile]: { display: 'none' },
});
const Card = styled.div<{ variant: ToastVariant }>(({ variant }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: 16,
  width: 200,
  maxWidth: 'calc(100vw - 32px)',
  padding: 10,
  borderRadius: 6,
  backgroundImage: backgrounds[variant],
  boxShadow: '4px 4px 10px 0 rgb(0 0 0 / 20%)',
  pointerEvents: 'auto',
  cursor: 'pointer',
  animation: 'semo-toast-in .2s ease-out',
  '@keyframes semo-toast-in': {
    from: { opacity: 0, transform: 'translateY(-8px)' },
    to: { opacity: 1, transform: 'none' },
  },
}));
const TextBox = styled.div({
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  gap: 2,
  minWidth: 0,
});
const Message = styled.p({ ...textStyle.subtitle, color: c.gray900 });
const Description = styled.p({ fontSize: 8, lineHeight: 1.4, color: c.gray900 });
const ActionButton = styled.button({
  alignSelf: 'flex-start',
  marginTop: 2,
  border: 0,
  borderRadius: 6,
  padding: '4px 10px',
  background: c.primary,
  color: c.white,
  cursor: 'pointer',
  ...textStyle.label,
});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);
  const dismiss = useCallback((id: number) => setToasts((ts) => ts.filter((t) => t.id !== id)), []);
  const show = useCallback(
    (variant: ToastVariant, message: string, description?: string, options?: ToastOptions) => {
      const id = ++idRef.current;
      setToasts((ts) => [
        ...ts.slice(-2),
        { id, variant, message, description, action: options?.action },
      ]);
      // 액션이 있는 토스트는 자동으로 사라지지 않고 사용자가 액션을 실행하거나 직접 닫을 때까지 유지된다.
      if (!options?.action) setTimeout(() => dismiss(id), 3000);
    },
    [dismiss],
  );
  const toast = useMemo<ToastApi>(
    () => ({
      success: (message, description, options) => show('success', message, description, options),
      error: (message, description, options) => show('error', message, description, options),
      info: (message, description, options) => show('info', message, description, options),
    }),
    [show],
  );
  return (
    <ToastContext.Provider value={toast}>
      {children}
      <Viewport aria-live="polite">
        {toasts.map((t) => (
          <Card
            key={t.id}
            variant={t.variant}
            role={t.variant === 'error' ? 'alert' : 'status'}
            onClick={() => dismiss(t.id)}
          >
            <Icon name={iconNames[t.variant]} size={26} alt="" />
            <TextBox>
              <Message>{t.message}</Message>
              {t.description ? <Description>{t.description}</Description> : null}
              {t.action ? (
                <ActionButton
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    t.action?.onClick();
                    dismiss(t.id);
                  }}
                >
                  {t.action.label}
                </ActionButton>
              ) : null}
            </TextBox>
          </Card>
        ))}
      </Viewport>
    </ToastContext.Provider>
  );
}
