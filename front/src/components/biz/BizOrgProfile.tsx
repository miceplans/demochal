'use client';

import type { ReactNode } from 'react';
import styled from '@emotion/styled';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';

const ICON = '/assets/icons';

/** 기업 프로필 미리보기 — 배너 / 로고 / 기업명 / 지도 / 연락처 (Figma 2-대시보드 프로필 · 프로필 수정). */
export function BizOrgProfile({
  bannerUrl,
  logoUrl,
  name,
  address,
  phone,
  email,
  action,
  bannerInput,
  logoInput,
}: {
  bannerUrl?: string | null;
  logoUrl?: string | null;
  name: ReactNode;
  address?: ReactNode;
  phone?: ReactNode;
  email?: ReactNode;
  /** 이름 옆에 붙는 액션(예: 프로필 수정 버튼) */
  action?: ReactNode;
  /** 수정 화면에서 배너/로고를 클릭해 파일을 고를 수 있게 하는 <input type="file"> */
  bannerInput?: ReactNode;
  logoInput?: ReactNode;
}) {
  return (
    <Root>
      <Banner as={bannerInput ? 'label' : 'div'}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {bannerUrl ? <img src={bannerUrl} alt="" /> : null}
        {bannerInput}
      </Banner>
      <Identity>
        <Logo as={logoInput ? 'label' : 'div'}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {logoUrl ? <img src={logoUrl} alt="" /> : null}
          {logoInput}
        </Logo>
        <Name>{name}</Name>
        {action}
      </Identity>
      <Info>
        <MapImg src="/assets/operations-map.png" alt="" />
        <InfoList>
          <InfoItem>
            <img src={`${ICON}/pin.svg`} alt="" width={24} height={24} />
            <span>{address}</span>
          </InfoItem>
          <InfoItem>
            <img src={`${ICON}/phone.svg`} alt="" width={24} height={24} />
            <span>{phone}</span>
          </InfoItem>
          <InfoItem>
            <img src={`${ICON}/mail.svg`} alt="" width={24} height={24} />
            <span>{email}</span>
          </InfoItem>
        </InfoList>
      </Info>
    </Root>
  );
}

const Root = styled.div({
  position: 'relative',
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
});
const Banner = styled.div({
  display: 'block',
  cursor: 'inherit',
  height: 276,
  borderRadius: 19,
  background: c.gray100,
  overflow: 'hidden',
  '& img': { width: '100%', height: '100%', objectFit: 'cover' },
});
const Identity = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: 16,
  marginTop: -115,
  paddingLeft: 36,
});
const Logo = styled.div({
  display: 'block',
  cursor: 'inherit',
  width: 200,
  height: 200,
  flexShrink: 0,
  borderRadius: '50%',
  background: c.gray100,
  overflow: 'hidden',
  alignSelf: 'flex-start',
  '& img': { width: '100%', height: '100%', objectFit: 'cover' },
});
const Name = styled.div({ marginTop: 70, ...textStyle.display, color: '#000' });
const Info = styled.div({ display: 'flex', alignItems: 'center', gap: 27, marginTop: 32 });
const MapImg = styled.img({ width: 300, height: 184, borderRadius: 8, objectFit: 'cover' });
const InfoList = styled.div({ display: 'flex', flexDirection: 'column', gap: 16 });
const InfoItem = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  ...textStyle.body,
  color: '#000',
});
