'use client';
import styled from '@emotion/styled';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { Logo, PrimaryButton } from '@/components/biz/BizShell';
import { orgProfile } from '@/data/biz-design';
import { maskEmail, maskPhone } from '@/lib/mask';
import { MaskedText } from '@/components/ui/MaskedText';

const ICON = '/assets/icons';

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

const Form = styled.form({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  width: '100%',
});
const FieldGroup = styled.div({ display: 'flex', flexDirection: 'column', gap: 8 });
const FieldLabel = styled.label({ ...textStyle.bodyLarge, color: c.gray900 });
const TextInput = styled.input({
  height: 40,
  border: `0.5px solid ${c.gray300}`,
  borderRadius: 8,
  padding: '0 14px',
  background: c.white,
  '&::placeholder': { color: c.gray500 },
  '&:focus': { outline: 'none', borderColor: c.primary },
});
const TextArea = styled.textarea({
  height: 118,
  border: `0.5px solid ${c.gray300}`,
  borderRadius: 8,
  padding: '14px',
  resize: 'none',
  fontFamily: 'inherit',
  fontSize: 'inherit',
  '&::placeholder': { color: c.gray500 },
  '&:focus': { outline: 'none', borderColor: c.primary },
});
const SubmitButton = styled(PrimaryButton)({ width: 183, height: 37 });

const InfoRow = styled.div({ display: 'flex', gap: 27, alignItems: 'center' });
const MapImg = styled.img({ width: 300, height: 184, borderRadius: 8, objectFit: 'cover' });
const InfoList = styled.div({ display: 'flex', flexDirection: 'column', gap: 16 });
const InfoItem = styled.div({ display: 'flex', gap: 8, alignItems: 'center' });
const InfoIcon = styled.img({ width: 24, height: 24 });
const InfoText = styled.p({ ...textStyle.body, color: '#000' });

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
        <Form id="operations-inquiry" onSubmit={(e) => e.preventDefault()}>
          <FieldGroup>
            <FieldLabel htmlFor="op-name">성함</FieldLabel>
            <TextInput id="op-name" name="name" />
          </FieldGroup>
          <FieldGroup>
            <FieldLabel htmlFor="op-phone">연락처</FieldLabel>
            <TextInput id="op-phone" name="phone" />
          </FieldGroup>
          <FieldGroup>
            <FieldLabel htmlFor="op-message">문의내용</FieldLabel>
            <TextArea id="op-message" name="message" />
          </FieldGroup>
        </Form>
        <SubmitButton type="submit" form="operations-inquiry">
          문의하기
        </SubmitButton>
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
            <InfoText><MaskedText value={orgProfile.phone} masked={maskPhone(orgProfile.phone)} /></InfoText>
          </InfoItem>
          <InfoItem>
            <InfoIcon src={`${ICON}/mail.svg`} alt="" />
            <InfoText><MaskedText value={orgProfile.email} masked={maskEmail(orgProfile.email)} /></InfoText>
          </InfoItem>
        </InfoList>
      </InfoRow>
    </Wrap>
  );
}
