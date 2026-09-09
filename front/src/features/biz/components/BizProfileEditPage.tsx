'use client';
import { useState, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import styled from '@emotion/styled';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { BizContent, PrimaryButton, OutlineButton, useBizHref } from '@/components/biz/BizShell';
import { orgProfile } from '@/data/biz-design';

const ICON = '/assets/icons';

const Actions = styled.div({ display: 'flex', justifyContent: 'flex-end', gap: 7 });

const BannerWrap = styled.div({ position: 'relative' });
const BannerUpload = styled.label({
  display: 'block',
  width: '100%',
  height: 276,
  borderRadius: 19,
  background: c.gray100,
  cursor: 'pointer',
  overflow: 'hidden',
});
const BannerImg = styled.img({ width: '100%', height: '100%', objectFit: 'cover' });
const HiddenInput = styled.input({
  position: 'absolute',
  width: 1,
  height: 1,
  opacity: 0,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
});
const LogoRow = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: 16,
  marginTop: -76,
  marginLeft: 40,
  position: 'relative',
});
const LogoUpload = styled.label({
  display: 'block',
  width: 160,
  height: 160,
  borderRadius: 15,
  background: c.gray200,
  border: `4px solid ${c.white}`,
  boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
  cursor: 'pointer',
  overflow: 'hidden',
  flexShrink: 0,
});
const LogoImg = styled.img({ width: '100%', height: '100%', objectFit: 'cover' });
const NameInput = styled.input({
  border: 0,
  borderBottom: `1px solid transparent`,
  background: 'transparent',
  padding: '0 0 4px',
  ...textStyle.display,
  color: c.gray900,
  width: 320,
  maxWidth: '100%',
  '&::placeholder': { color: c.gray500 },
  '&:hover, &:focus': { borderBottomColor: c.gray300 },
  '&:focus': { outline: 'none' },
});

const InfoRow = styled.div({ display: 'flex', gap: 27, alignItems: 'center', flexWrap: 'wrap' });
const MapImg = styled.img({ width: 300, height: 184, borderRadius: 8, objectFit: 'cover', flexShrink: 0 });
const InfoList = styled.div({ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 280 });
const InfoItem = styled.div({ display: 'flex', gap: 8, alignItems: 'center' });
const InfoIcon = styled.img({ width: 24, height: 24, flexShrink: 0 });
const InfoInput = styled.input({
  flex: 1,
  height: 36,
  border: `1px solid ${c.gray300}`,
  borderRadius: 8,
  padding: '0 12px',
  ...textStyle.body,
  '&::placeholder': { color: c.gray500 },
  '&:focus': { outline: 'none', borderColor: c.primary },
});

const ToolbarWrap = styled.div({ display: 'flex', justifyContent: 'center' });
const Toolbar = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: 24,
  padding: '16px 20px',
  borderRadius: 12,
  background: c.white,
  boxShadow: '-4px -4px 5px rgba(0,0,0,0.1), 4px 4px 5px rgba(0,0,0,0.1)',
});
const ToolbarButton = styled.button({
  width: 24,
  height: 24,
  padding: 0,
  border: 0,
  background: 'transparent',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
});
const ToolbarIcon = styled.img({ width: 24, height: 24, objectFit: 'contain' });

const toolbarItems = [
  { key: 'link', label: '링크 추가', icon: 'toolbar-link.svg' },
  { key: 'text', label: '텍스트 추가', icon: 'toolbar-text.svg' },
  { key: 'file', label: '파일 추가', icon: 'toolbar-file.svg' },
  { key: 'layout', label: '레이아웃 추가', icon: 'toolbar-layout.svg' },
  { key: 'image', label: '이미지 추가', icon: 'toolbar-image.svg' },
] as const;

export function BizProfileEditPage() {
  const router = useRouter();
  const hrefOf = useBizHref();
  const [name, setName] = useState(orgProfile.name);
  const [address, setAddress] = useState(orgProfile.address);
  const [phone, setPhone] = useState(orgProfile.phone);
  const [email, setEmail] = useState(orgProfile.email);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const pickImage = (setter: (url: string) => void) => (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setter(URL.createObjectURL(file));
  };

  const goToProfile = () => router.push(hrefOf('/profile'));

  return (
    <BizContent>
      <Actions>
        <OutlineButton type="button" onClick={goToProfile}>
          취소
        </OutlineButton>
        <PrimaryButton type="button" onClick={goToProfile}>
          저장
        </PrimaryButton>
      </Actions>

      <BannerWrap>
        <BannerUpload aria-label="배너 이미지 변경">
          {bannerPreview && <BannerImg src={bannerPreview} alt="" />}
          <HiddenInput type="file" accept="image/*" onChange={pickImage(setBannerPreview)} />
        </BannerUpload>
        <LogoRow>
          <LogoUpload aria-label="기업 로고 변경">
            {logoPreview && <LogoImg src={logoPreview} alt="" />}
            <HiddenInput type="file" accept="image/*" onChange={pickImage(setLogoPreview)} />
          </LogoUpload>
          <NameInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="기업명을 입력해주세요"
            aria-label="기업명"
          />
        </LogoRow>
      </BannerWrap>

      <InfoRow>
        <MapImg src="/assets/operations-map.png" alt="" />
        <InfoList>
          <InfoItem>
            <InfoIcon src={`${ICON}/pin.svg`} alt="" />
            <InfoInput
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="주소를 입력해주세요"
              aria-label="주소"
            />
          </InfoItem>
          <InfoItem>
            <InfoIcon src={`${ICON}/phone.svg`} alt="" />
            <InfoInput
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="전화번호를 입력해주세요"
              aria-label="전화번호"
            />
          </InfoItem>
          <InfoItem>
            <InfoIcon src={`${ICON}/mail.svg`} alt="" />
            <InfoInput
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="이메일을 입력해주세요"
              aria-label="이메일"
            />
          </InfoItem>
        </InfoList>
      </InfoRow>

      <ToolbarWrap>
        <Toolbar role="toolbar" aria-label="콘텐츠 추가">
          {toolbarItems.map(({ key, label, icon }) => (
            <ToolbarButton key={key} type="button" aria-label={label}>
              <ToolbarIcon src={`${ICON}/${icon}`} alt="" />
            </ToolbarButton>
          ))}
        </Toolbar>
      </ToolbarWrap>
    </BizContent>
  );
}
