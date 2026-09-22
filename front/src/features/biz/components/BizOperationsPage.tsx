'use client';
import { useState, type FormEvent } from 'react';
import styled from '@emotion/styled';
import { generated } from '@semochal/api-client';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { Logo, PrimaryButton } from '@/components/biz/BizShell';
import { useToast } from '@/components/common/Toast';
import { orgProfile } from '@/data/biz-design';

const ICON = '/assets/icons';
type InquiryField = 'name' | 'contact' | 'content';

export function BizOperationsPage() {
  const toast = useToast();
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<InquiryField, string>>>({});

  const clearFieldError = (field: InquiryField) => {
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  };

  const submitInquiry = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    const values = {
      name: name.trim(),
      contact: contact.trim(),
      content: content.trim(),
    };
    const errors: Partial<Record<InquiryField, string>> = {
      ...(!values.name
        ? { name: '성함을 입력해주세요.' }
        : values.name.length > 100
          ? { name: '성함은 100자 이내로 입력해주세요.' }
          : {}),
      ...(!values.contact
        ? { contact: '연락처를 입력해주세요.' }
        : values.contact.length > 200
          ? { contact: '연락처는 200자 이내로 입력해주세요.' }
          : {}),
      ...(!values.content
        ? { content: '문의 내용을 입력해주세요.' }
        : values.content.length > 4000
          ? { content: '문의 내용은 4,000자 이내로 입력해주세요.' }
          : {}),
    };
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      const message = Object.values(errors)
        .filter((error): error is string => Boolean(error))
        .join(' ');
      setStatus(message);
      toast.error('입력 내용을 확인해주세요', message);
      return;
    }

    setSubmitting(true);
    setFieldErrors({});
    setStatus('문의 내용을 전송하고 있습니다.');
    try {
      await generated.submitOperationsInquiry(values);
      setName('');
      setContact('');
      setContent('');
      setStatus('문의가 접수되었습니다. 담당자가 확인 후 연락드리겠습니다.');
      toast.success('문의가 접수되었습니다', '담당자가 확인 후 연락드리겠습니다.');
    } catch {
      const message = '문의 접수에 실패했습니다. 잠시 후 다시 시도해주세요.';
      setStatus(message);
      toast.error('문의 접수 실패', message);
    } finally {
      setSubmitting(false);
    }
  };

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
        <Form id="operations-inquiry" onSubmit={submitInquiry} noValidate>
          <FieldGroup>
            <FieldLabel htmlFor="op-name">성함</FieldLabel>
            <TextInput
              id="op-name"
              name="name"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                clearFieldError('name');
              }}
              autoComplete="name"
              aria-invalid={Boolean(fieldErrors.name)}
              disabled={submitting}
              maxLength={100}
              required
            />
          </FieldGroup>
          <FieldGroup>
            <FieldLabel htmlFor="op-contact">연락처</FieldLabel>
            <TextInput
              id="op-contact"
              name="contact"
              value={contact}
              onChange={(event) => {
                setContact(event.target.value);
                clearFieldError('contact');
              }}
              autoComplete="tel"
              aria-invalid={Boolean(fieldErrors.contact)}
              disabled={submitting}
              maxLength={200}
              required
            />
          </FieldGroup>
          <FieldGroup>
            <FieldLabel htmlFor="op-message">문의내용</FieldLabel>
            <TextArea
              id="op-message"
              name="content"
              value={content}
              onChange={(event) => {
                setContent(event.target.value);
                clearFieldError('content');
              }}
              aria-invalid={Boolean(fieldErrors.content)}
              disabled={submitting}
              maxLength={4000}
              required
            />
          </FieldGroup>
        </Form>
        <SubmitButton type="submit" form="operations-inquiry" disabled={submitting}>
          {submitting ? '문의 접수 중...' : '문의하기'}
        </SubmitButton>
        <Status role="status" aria-live="polite">
          {status}
        </Status>
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
const Status = styled.p({ minHeight: 20, margin: 0, color: c.gray700, ...textStyle.metaText });

const InfoRow = styled.div({ display: 'flex', gap: 27, alignItems: 'center' });
const MapImg = styled.img({ width: 300, height: 184, borderRadius: 8, objectFit: 'cover' });
const InfoList = styled.div({ display: 'flex', flexDirection: 'column', gap: 16 });
const InfoItem = styled.div({ display: 'flex', gap: 8, alignItems: 'center' });
const InfoIcon = styled.img({ width: 24, height: 24 });
const InfoText = styled.p({ ...textStyle.body, color: '#000' });
