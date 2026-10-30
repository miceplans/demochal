'use client';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import styled from '@emotion/styled';
import { Button, Icon } from '@/components/common/Primitives';
import { useToast } from '@/components/common/Toast';
import { colors as c, mobile } from '@/styles/design';
import { textStyle } from '@/styles/typography';

// TODO: 카카오톡 공유는 Kakao JS SDK 앱 키가 필요해 보류 — https://developers.kakao.com/docs/latest/ko/kakaotalk-share/js
interface ShareMenuProps {
  title: string;
}

const Backdrop = styled.div({
  position: 'fixed',
  zIndex: 1000,
  inset: 0,
  display: 'grid',
  placeItems: 'center',
  padding: 20,
  background: 'rgba(0,0,0,.45)',
  [mobile]: { alignItems: 'end', padding: 0 },
});
const Dialog = styled.div({
  width: 'min(100%, 400px)',
  padding: 24,
  borderRadius: 14,
  background: c.white,
  boxShadow: '0 16px 48px rgba(0,0,0,.22)',
  [mobile]: { width: '100%', borderRadius: '14px 14px 0 0', paddingBottom: 32 },
});
const Header = styled.div({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 20,
  h2: { margin: 0, ...textStyle.h3_2 },
});
const CloseButton = styled.button({
  border: 0,
  background: 'transparent',
  padding: 4,
  fontSize: 24,
  lineHeight: 1,
  color: c.gray500,
  cursor: 'pointer',
});
const Targets = styled.div({
  display: 'flex',
  flexWrap: 'wrap',
  gap: 16,
  marginBottom: 24,
});
const targetStyle = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 8,
  width: 64,
  padding: 0,
  border: 0,
  background: 'transparent',
  fontFamily: 'inherit',
  fontSize: textStyle.overline.fontSize,
  color: c.gray700,
  textDecoration: 'none',
  cursor: 'pointer',
  '.circle': {
    display: 'grid',
    placeItems: 'center',
    width: 48,
    height: 48,
    borderRadius: '50%',
    background: c.gray100,
    color: c.gray900,
    fontSize: 18,
    fontWeight: 700,
    transition: 'background 0.12s ease',
  },
  '&:hover .circle': { background: c.gray200 },
} as const;
const TargetButton = styled.button(targetStyle);
const TargetLink = styled.a(targetStyle);
const LinkRow = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 6px 6px 14px',
  border: `0.5px solid ${c.gray200}`,
  borderRadius: 8,
  input: {
    flex: 1,
    minWidth: 0,
    border: 0,
    outline: 'none',
    background: 'transparent',
    fontFamily: 'inherit',
    fontSize: textStyle.caption.fontSize,
    color: c.gray700,
  },
});

const MessageIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M4 5h16v11H9l-5 4V5z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
  </svg>
);

export function ShareMenu({ title }: ShareMenuProps) {
  const toast = useToast();
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [canNativeShare, setCanNativeShare] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const openDialog = () => {
    setUrl(window.location.href);
    setCanNativeShare(typeof navigator.share === 'function');
    setOpen(true);
  };
  const close = () => setOpen(false);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('링크를 복사했어요');
      close();
    } catch {
      toast.error('링크 복사 실패', '주소창의 링크를 복사해주세요');
    }
  };

  const nativeShare = async () => {
    try {
      await navigator.share({ title, url });
      close();
    } catch {
      // 사용자가 공유 시트를 닫은 경우(AbortError)도 여기로 오므로 별도 안내하지 않는다.
    }
  };

  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  const link = (label: string, href: string, glyph: ReactNode, external = false) => (
    <TargetLink
      href={href}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      onClick={close}
    >
      <span className="circle">{glyph}</span>
      {label}
    </TargetLink>
  );

  return (
    <>
      <Button small tone="plain" aria-haspopup="dialog" onClick={openDialog}>
        <Icon src="/assets/icons/share-ic.png" size={14} alt="공유" />
        공유
      </Button>
      {open &&
        createPortal(
          <Backdrop
            role="presentation"
            onMouseDown={(e) => e.currentTarget === e.target && close()}
          >
            <Dialog role="dialog" aria-modal="true" aria-labelledby={titleId}>
              <Header>
                <h2 id={titleId}>공유하기</h2>
                <CloseButton type="button" aria-label="닫기" onClick={close}>
                  ×
                </CloseButton>
              </Header>
              <Targets>
                {canNativeShare && (
                  <TargetButton type="button" onClick={nativeShare}>
                    <span className="circle">
                      <Icon src="/assets/icons/share-ic.png" size={20} alt="" />
                    </span>
                    다른 앱
                  </TargetButton>
                )}
                {link(
                  '메시지',
                  `sms:?&body=${encodeURIComponent(`${title}\n`)}${encodedUrl}`,
                  <MessageIcon />,
                )}
                {link(
                  '이메일',
                  `mailto:?subject=${encodedTitle}&body=${encodedUrl}`,
                  <Icon src="/assets/icons/mail.svg" size={22} alt="" />,
                )}
                {link(
                  'X',
                  `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`,
                  'X',
                  true,
                )}
                {link(
                  '페이스북',
                  `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
                  'f',
                  true,
                )}
              </Targets>
              <LinkRow>
                <input
                  readOnly
                  value={url}
                  aria-label="공유 링크"
                  onFocus={(e) => e.target.select()}
                />
                <Button small tone="primary" onClick={copyLink}>
                  링크 복사
                </Button>
              </LinkRow>
            </Dialog>
          </Backdrop>,
          document.body,
        )}
    </>
  );
}
