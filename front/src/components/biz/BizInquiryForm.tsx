'use client';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import styled from '@emotion/styled';
import { generated } from '@semochal/api-client';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { PrimaryButton } from '@/components/biz/BizShell';
import { useToast } from '@/components/common/Toast';
import { apiErrorMessage } from '@/lib/api-error';
import { clearFormDraft, readFormDraft, useFormDraftSaver } from '@/lib/form-draft';

type InquiryField = 'name' | 'contact' | 'content';

type InquiryDraft = { name: string; contact: string; content: string };

const INQUIRY_DRAFT_KEY = 'biz-inquiry';
const EMPTY_INQUIRY: InquiryDraft = { name: '', contact: '', content: '' };

const isInquiryDraft = (value: unknown): value is InquiryDraft => {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.name === 'string' && typeof v.contact === 'string' && typeof v.content === 'string'
  );
};

export function BizInquiryForm() {
  const toast = useToast();
  // SSR 프리렌더와 클라이언트 hydration 렌더가 일치하도록 모든 state는 pristine으로 시작하고,
  // 초안은 마운트 effect에서 복원한다.
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<InquiryField, string>>>({});
  // 초안 복원이 끝나기 전에는 저장기를 렌더링하지 않는다 — 복원 전 pristine 값으로 저장된
  // 초안을 지우거나 덮어쓰는 것을 막는다.
  const [restored, setRestored] = useState(false);

  // 마운트 시 한 번만 초안을 읽어 복원한다 — hydration 일치를 위해 렌더가 아니라 effect에서 적용한다.
  useEffect(() => {
    const draft = readFormDraft<InquiryDraft>(INQUIRY_DRAFT_KEY, isInquiryDraft);
    if (draft) {
      // localStorage(외부 시스템)에서 읽은 초안을 hydration 이후 한 번만 동기화한다.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setName(draft.name);
      setContact(draft.contact);
      setContent(draft.content);
    }
    setRestored(true);
  }, []);

  const draftValue = useMemo<InquiryDraft>(
    () => ({ name, contact, content }),
    [name, contact, content],
  );

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
      // 전송에 성공했으므로 초안을 지운다.
      clearFormDraft(INQUIRY_DRAFT_KEY);
      setName('');
      setContact('');
      setContent('');
      setStatus('문의가 접수되었습니다. 담당자가 확인 후 연락드리겠습니다.');
      toast.success('문의가 접수되었습니다', '담당자가 확인 후 연락드리겠습니다.');
    } catch (error) {
      const message = apiErrorMessage(
        error,
        '문의 접수에 실패했습니다. 잠시 후 다시 시도해주세요.',
      );
      setStatus(message);
      toast.error('문의 접수 실패', message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Wrap>
      {restored ? (
        <DraftSaver draftKey={INQUIRY_DRAFT_KEY} value={draftValue} baseline={EMPTY_INQUIRY} />
      ) : null}
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
    </Wrap>
  );
}

/** useFormDraftSaver를 조건에 따라 끄기 위한 래퍼 — 훅은 조건적으로 부를 수 없어 렌더링 여부로 제어한다. */
function DraftSaver({
  draftKey,
  value,
  baseline,
}: {
  draftKey: string;
  value: unknown;
  baseline: unknown;
}) {
  useFormDraftSaver(draftKey, value, { baseline });
  return null;
}

const Wrap = styled.div({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  alignItems: 'center',
  width: '100%',
});
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
  border: `0.5px solid ${c.gray200}`,
  borderRadius: 8,
  padding: '0 14px',
  background: c.white,
  '&::placeholder': { color: c.gray500 },
  '&:focus': { outline: 'none', borderColor: c.primary },
});
const TextArea = styled.textarea({
  height: 118,
  border: `0.5px solid ${c.gray200}`,
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
