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
type ToastItem = { id: number; variant: ToastVariant; message: string; description?: string };
export type ToastApi = Record<ToastVariant, (message: string, description?: string) => void>;

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
// Figma 토스트 모바일 변형(Variant4~6)은 16px 아이콘을 쓰는 흰 배경 한 줄 알약형이다.
const mobileIconSources: Record<ToastVariant, string> = {
  success: '/assets/icons/toast/mobile-success.svg',
  error: '/assets/icons/toast/mobile-error.svg',
  info: '/assets/icons/toast/mobile-info.svg',
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
  [mobile]: {
    top: 'auto',
    right: 'auto',
    bottom: 'calc(78px + env(safe-area-inset-bottom) + 16px)',
    left: '50%',
    transform: 'translateX(-50%)',
    alignItems: 'center',
  },
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
  '@keyframes semo-toast-in-up': {
    from: { opacity: 0, transform: 'translateY(8px)' },
    to: { opacity: 1, transform: 'none' },
  },
  [mobile]: {
    gap: 4,
    width: 'auto',
    padding: 6,
    backgroundImage: 'none',
    backgroundColor: c.white,
    animationName: 'semo-toast-in-up',
  },
}));
const DesktopIcon = styled(Icon)({ [mobile]: { display: 'none' } });
const MobileIcon = styled(Icon)({ display: 'none', [mobile]: { display: 'block' } });
const TextBox = styled.div({
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  gap: 2,
  minWidth: 0,
});
const Message = styled.p({
  ...textStyle.subtitle,
  color: c.gray900,
  [mobile]: {
    ...textStyle.mBadgeText,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
});
const Description = styled.p({
  fontSize: 8,
  lineHeight: 1.4,
  color: c.gray900,
  [mobile]: { display: 'none' },
});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);
  const dismiss = useCallback((id: number) => setToasts((ts) => ts.filter((t) => t.id !== id)), []);
  const show = useCallback(
    (variant: ToastVariant, message: string, description?: string) => {
      const id = ++idRef.current;
      setToasts((ts) => [...ts.slice(-2), { id, variant, message, description }]);
      setTimeout(() => dismiss(id), 3000);
    },
    [dismiss],
  );
  const toast = useMemo<ToastApi>(
    () => ({
      success: (message, description) => show('success', message, description),
      error: (message, description) => show('error', message, description),
      info: (message, description) => show('info', message, description),
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
            <DesktopIcon name={iconNames[t.variant]} size={26} alt="" />
            <MobileIcon src={mobileIconSources[t.variant]} size={16} alt="" />
            <TextBox>
              <Message>{t.message}</Message>
              {t.description ? <Description>{t.description}</Description> : null}
            </TextBox>
          </Card>
        ))}
      </Viewport>
    </ToastContext.Provider>
  );
}
