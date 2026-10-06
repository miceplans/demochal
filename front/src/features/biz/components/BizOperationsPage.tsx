'use client';
import styled from '@emotion/styled';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { Logo } from '@/components/biz/BizShell';
import { BizInquiryForm } from '@/components/biz/BizInquiryForm';
import { orgProfile } from '@/data/biz-design';

const ICON = '/assets/icons';

export function BizOperationsPage() {
  return (
    <Wrap>
      <TopBlock>
        <Header>
          <Brand>
            <MiceLogo src="/assets/mice-plans-logo.png" alt="MICE PLANS" />
            <Cross>X</Cross>
            <Logo size={11} />
          </Brand>
          <Title>온라인 상담 및 견적 문의</Title>
        </Header>
        <BizInquiryForm />
      </TopBlock>
      <InfoRow>
        <MapImg src="/assets/operations-map.png" alt="센텀IS타워 위치" />
        <InfoList>
          <InfoItem>
            <InfoIcon src={`${ICON}/pin.svg`} alt="" />
            <InfoText>{orgProfile.address}</InfoText>
          </InfoItem>
          <InfoItem>
            <InfoIcon src={`${ICON}/phone.svg`} alt="" />
            <InfoText>{orgProfile.phone}</InfoText>
          </InfoItem>
          <InfoItem>
            <InfoIcon src={`${ICON}/mail.svg`} alt="" />
            <InfoText>{orgProfile.email}</InfoText>
          </InfoItem>
        </InfoList>
      </InfoRow>
    </Wrap>
  );
}

const Wrap = styled.div({
  display: 'flex',
  flexDirection: 'column',
  gap: 32,
  alignItems: 'center',
});
const TopBlock = styled.div({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  alignItems: 'center',
  justifyContent: 'center',
  padding: '32px 0',
  width: 500,
});
const Header = styled.div({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  alignItems: 'center',
});
const Brand = styled.div({ display: 'flex', alignItems: 'center', gap: 14 });
const MiceLogo = styled.img({ height: 14, width: 'auto' });
const Cross = styled.span({ ...textStyle.h3_2, color: c.gray900 });
const Title = styled.h1({ ...textStyle.display, color: c.gray900 });

const InfoRow = styled.div({ display: 'flex', gap: 27, alignItems: 'center' });
const MapImg = styled.img({ width: 300, height: 184, borderRadius: 8, objectFit: 'cover' });
const InfoList = styled.div({ display: 'flex', flexDirection: 'column', gap: 16 });
const InfoItem = styled.div({ display: 'flex', gap: 8, alignItems: 'center' });
const InfoIcon = styled.img({ width: 24, height: 24 });
const InfoText = styled.p({ ...textStyle.body, color: '#000' });
