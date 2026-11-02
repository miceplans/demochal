'use client';

import type { ReactNode } from 'react';
import styled from '@emotion/styled';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { LocationMap } from '@/components/biz/LocationMap';

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
  mapLatitude,
  mapLongitude,
  mapAddress,
  mapEditable = false,
  onMapChange,
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
  /** 프로필 지도 핀 좌표 — 없으면 mapAddress(또는 address 원문)로 지도를 표시한다 */
  mapLatitude?: number | null;
  mapLongitude?: number | null;
  mapAddress?: string | null;
  /** true면 지도 핀 드래그·클릭으로 위치를 조정할 수 있다(편집 화면 전용) */
  mapEditable?: boolean;
  onMapChange?: (latitude: number, longitude: number) => void;
}) {
  return (
    <Root>
      <Banner as={bannerInput ? 'label' : 'div'}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {bannerUrl ? <img src={bannerUrl} alt="" /> : null}
        {bannerInput}
        {bannerInput ? (
          <BannerBadge>{bannerUrl ? '배경 이미지 변경' : '배경 이미지 추가'}</BannerBadge>
        ) : null}
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
        <MapBox>
          <LocationMap
            latitude={mapLatitude}
            longitude={mapLongitude}
            address={mapAddress}
            editable={mapEditable}
            onChange={onMapChange}
          />
        </MapBox>
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
  position: 'relative',
  height: 276,
  borderRadius: 19,
  background: c.gray100,
  overflow: 'hidden',
  '& img': { width: '100%', height: '100%', objectFit: 'cover' },
});
// 배너 클릭 업로드는 기존 그대로 두고, 배경 이미지를 바꿀 수 있다는 표시만 올린다.
const BannerBadge = styled.span({
  position: 'absolute',
  right: 16,
  bottom: 16,
  padding: '8px 14px',
  borderRadius: 8,
  background: 'rgba(0, 0, 0, 0.55)',
  color: c.white,
  ...textStyle.subtitle,
  pointerEvents: 'none',
});
const Identity = styled.div({
  // 배너가 position을 갖게 돼서(배지 포지셔닝) 포지션 레이어에서 프사·기업명이 배너 뒤로 가려지지 않게
  // 같은 레이어에서 DOM 순서가 뒤인 Identity를 포지션 요소로 올린다.
  position: 'relative',
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
const MapBox = styled.div({
  width: 300,
  height: 184,
  flexShrink: 0,
  borderRadius: 8,
  overflow: 'hidden',
});
const InfoList = styled.div({ display: 'flex', flexDirection: 'column', gap: 16 });
const InfoItem = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  ...textStyle.body,
  color: '#000',
});
