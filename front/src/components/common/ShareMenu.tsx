'use client';
import { useEffect, useRef, useState } from 'react';
import styled from '@emotion/styled';
import { Button, Icon } from '@/components/common/Primitives';
import { useToast } from '@/components/common/Toast';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';

// TODO: 카카오톡 공유는 Kakao JS SDK 앱 키가 필요해 보류 — https://developers.kakao.com/docs/latest/ko/kakaotalk-share/js
interface ShareMenuProps {
  title: string;
}

const Wrapper = styled.div`
  position: relative;
`;

const Menu = styled.div`
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  z-index: 30;
  min-width: 180px;
  padding: 6px;
  background: ${c.white};
  border: 0.5px solid ${c.gray200};
  border-radius: 8px;
  box-shadow: 0 4px 12px rgb(0 0 0 / 10%);
  animation: semo-share-in 0.16s ease-out;
  @keyframes semo-share-in {
    from {
      opacity: 0;
      transform: translateY(-6px);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }
`;

const itemStyle = `
  display: block;
  width: 100%;
  padding: 10px 12px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  font-family: inherit;
  font-size: ${textStyle.caption.fontSize}px;
  font-weight: ${textStyle.caption.fontWeight};
  color: ${c.gray900};
  text-align: left;
  text-decoration: none;
  cursor: pointer;
  &:hover {
    background: ${c.gray100};
  }
`;

const MenuButton = styled.button`
  ${itemStyle}
`;
const MenuLink = styled.a`
  ${itemStyle}
`;

export function ShareMenu({ title }: ShareMenuProps) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const [url, setUrl] = useState('');

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const toggle = () => {
    if (!open) {
      setUrl(window.location.href);
      setCanNativeShare(typeof navigator.share === 'function');
    }
    setOpen((v) => !v);
  };

  const copyLink = async () => {
    setOpen(false);
    try {
      await navigator.clipboard.writeText(url);
      toast.success('링크를 복사했어요');
    } catch {
      toast.error('링크 복사 실패', '주소창의 링크를 복사해주세요');
    }
  };

  const nativeShare = async () => {
    setOpen(false);
    try {
      await navigator.share({ title, url });
    } catch {
      // 사용자가 공유 시트를 닫은 경우(AbortError)도 여기로 오므로 별도 안내하지 않는다.
    }
  };

  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  const close = () => setOpen(false);

  return (
    <Wrapper ref={rootRef}>
      <Button small tone="plain" aria-haspopup="menu" aria-expanded={open} onClick={toggle}>
        <Icon src="/assets/icons/share-ic.png" size={14} alt="공유" />
        공유
      </Button>
      {open && (
        <Menu role="menu" aria-label="공유하기">
          <MenuButton type="button" role="menuitem" onClick={copyLink}>
            링크 복사
          </MenuButton>
          {canNativeShare && (
            <MenuButton type="button" role="menuitem" onClick={nativeShare}>
              다른 앱으로 공유
            </MenuButton>
          )}
          <MenuLink
            role="menuitem"
            href={`sms:?&body=${encodeURIComponent(`${title}\n`)}${encodedUrl}`}
            onClick={close}
          >
            메시지
          </MenuLink>
          <MenuLink
            role="menuitem"
            href={`mailto:?subject=${encodedTitle}&body=${encodedUrl}`}
            onClick={close}
          >
            이메일
          </MenuLink>
          <MenuLink
            role="menuitem"
            href={`https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={close}
          >
            X(트위터)
          </MenuLink>
          <MenuLink
            role="menuitem"
            href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={close}
          >
            페이스북
          </MenuLink>
        </Menu>
      )}
    </Wrapper>
  );
}
