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
  exiting?: boolean;
};
// 퇴장 애니메이션 길이와 dismiss 실제 제거 지연을 맞춘다.
const EXIT_ANIMATION_MS = 200;
// 화면에서 자체 액션 토스트로 조회 실패를 알리는 쿼리는 전역 QueryCache 에러 토스트를 건너뛴다(중복 알림 방지).
export const LOCAL_ERROR_TOAST_META = { localErrorToast: true } as const;
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
const Card = styled.div<{ variant: ToastVariant; exiting?: boolean }>(({ variant, exiting }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: 16,
  minWidth: 200,
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
  '@keyframes semo-toast-out': {
    from: { opacity: 1, transform: 'none' },
    to: { opacity: 0, transform: 'translateY(-8px)' },
  },
  '@keyframes semo-toast-out-up': {
    from: { opacity: 1, transform: 'none' },
    to: { opacity: 0, transform: 'translateY(8px)' },
  },
  // 등장과 대칭되는 퇴장 애니메이션. 애니메이션 후 실제 DOM 제거는 provider가 담당한다.
  ...(exiting
    ? {
        animation: 'semo-toast-out .2s ease-in forwards',
        '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
      }
    : {}),
  [mobile]: {
    gap: 4,
    width: 'auto',
    minWidth: 'auto',
    padding: 6,
    backgroundImage: 'none',
    backgroundColor: c.white,
    animationName: exiting ? 'semo-toast-out-up' : 'semo-toast-in-up',
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
  [mobile]: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
const Message = styled.p({
  // Figma 텍스트 스타일에 12px/500 조합이 없고(12px 토큰은 400/600뿐) 시안이 12px/500을 요구하므로 값만 직접 둔다.
  fontSize: 12,
  fontWeight: 500,
  lineHeight: 1.4,
  color: c.gray900,
  // 긴 메시지가 카드 높이를 늘리며 줄바꿈되지 않도록 한 줄 말줄임으로 유지한다.
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  [mobile]: {
    ...textStyle.mMicroTag,
  },
});
const Description = styled.p({
  fontSize: 8,
  lineHeight: 1.4,
  color: c.gray900,
  [mobile]: { display: 'none' },
});
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
  // 모바일 알약형 토스트에서는 메시지 옆 한 줄에 둔다.
  [mobile]: { alignSelf: 'center', marginTop: 0, padding: '2px 8px', flexShrink: 0 },
});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);
  // 먼저 exiting 플래그로 퇴장 애니메이션을 재생하고, 애니메이션 길이만큼 뒤에 DOM에서 제거한다.
  // 제거 timeout은 dismiss 호출마다 예약되지만 filter가 멱등해 중복 호출은 무해하다.
  const dismiss = useCallback((id: number) => {
    setToasts((ts) => {
      const target = ts.find((t) => t.id === id);
      if (!target || target.exiting) return ts;
      return ts.map((t) => (t.id === id ? { ...t, exiting: true } : t));
    });
    setTimeout(() => setToasts((ts) => ts.filter((t) => t.id !== id)), EXIT_ANIMATION_MS);
  }, []);
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
            exiting={t.exiting}
            role={t.variant === 'error' ? 'alert' : 'status'}
            onClick={() => dismiss(t.id)}
          >
            <DesktopIcon name={iconNames[t.variant]} size={26} alt="" />
            <MobileIcon src={mobileIconSources[t.variant]} size={16} alt="" />
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
