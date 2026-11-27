'use client';
import { useEffect, useMemo, useState } from 'react';
import { useForm, useWatch, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import styled from '@emotion/styled';
import { generated } from '@semochal/api-client';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { PrimaryButton } from '@/components/biz/BizShell';
import { useToast } from '@/components/common/Toast';
import { apiErrorMessage } from '@/lib/api-error';
import { clearFormDraft, readFormDraft, useFormDraftSaver } from '@/lib/form-draft';
import { bizInquirySchema, type BizInquiryFormValues } from '@/features/biz/schema';

const INQUIRY_DRAFT_KEY = 'biz-inquiry';
const EMPTY_INQUIRY: BizInquiryFormValues = { name: '', contact: '', content: '' };
// 에러 메시지를 status/toast에 합치는 순서 — 기존 수동 폼의 Object.values 순서와 같다.
const INQUIRY_FIELDS = ['name', 'contact', 'content'] as const;

const isInquiryDraft = (value: unknown): value is BizInquiryFormValues => {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.name === 'string' && typeof v.contact === 'string' && typeof v.content === 'string'
  );
};

export function BizInquiryForm() {
  const toast = useToast();
  const [status, setStatus] = useState('');
  // 초안 복원이 끝나기 전에는 저장기를 렌더링하지 않는다 — 복원 전 pristine 값으로 저장된
  // 초안을 지우거나 덮어쓰는 것을 막는다.
  const [restored, setRestored] = useState(false);

  // SSR 프리렌더와 클라이언트 hydration 렌더가 일치하도록 defaultValues는 pristine으로 시작하고,
  // 초안은 마운트 effect에서 reset으로 복원한다.
  const {
    register,
    handleSubmit,
    reset,
    clearErrors,
    control,
    formState: { errors, isSubmitting },
  } = useForm<BizInquiryFormValues>({
    resolver: zodResolver(bizInquirySchema),
    defaultValues: EMPTY_INQUIRY,
    // 기존 수동 폼과 같은 에러 노출 타이밍: 검증은 제출 시에만 하고, 입력을 고치면 해당 필드의
    // 에러만 즉시 지운다(다음 제출 때 전체를 다시 검증한다).
    reValidateMode: 'onSubmit',
    // 기존 폼은 검증 실패 시 포커스를 옮기지 않는다.
    shouldFocusError: false,
  });

  // 마운트 시 한 번만 초안을 읽어 복원한다 — hydration 일치를 위해 렌더가 아니라 effect에서 적용한다.
  useEffect(() => {
    const draft = readFormDraft<BizInquiryFormValues>(INQUIRY_DRAFT_KEY, isInquiryDraft);
    if (draft) reset(draft);
    // localStorage(외부 시스템)에서 읽은 초안의 복원 완료를 hydration 이후 한 번만 반영한다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRestored(true);
  }, [reset]);

  // 초안 저장용 구독 — React Compiler와 호환되는 useWatch를 쓴다(watch()는 lint 경고).
  const [name, contact, content] = useWatch({ control, name: ['name', 'contact', 'content'] });
  const draftValue = useMemo<BizInquiryFormValues>(
    () => ({ name, contact, content }),
    [name, contact, content],
  );

  const submitInquiry = async (values: BizInquiryFormValues) => {
    setStatus('문의 내용을 전송하고 있습니다.');
    try {
      await generated.submitOperationsInquiry(values);
      // 전송에 성공했으므로 초안을 지운다.
      clearFormDraft(INQUIRY_DRAFT_KEY);
      reset(EMPTY_INQUIRY);
      setStatus('문의가 접수되었습니다. 담당자가 확인 후 연락드리겠습니다.');
      toast.success('문의가 접수되었습니다', '담당자가 확인 후 연락드리겠습니다.');
    } catch (error) {
      const message = apiErrorMessage(
        error,
        '문의 접수에 실패했습니다. 잠시 후 다시 시도해주세요.',
      );
      setStatus(message);
      toast.error('문의 접수 실패', message);
    }
  };

  const showValidationErrors = (fieldErrors: FieldErrors<BizInquiryFormValues>) => {
    const message = INQUIRY_FIELDS.map((field) => fieldErrors[field]?.message)
      .filter((error): error is string => Boolean(error))
      .join(' ');
    setStatus(message);
    toast.error('입력 내용을 확인해주세요', message);
  };

  return (
    <Wrap>
      {restored ? (
        <DraftSaver draftKey={INQUIRY_DRAFT_KEY} value={draftValue} baseline={EMPTY_INQUIRY} />
      ) : null}
      <Form
        id="operations-inquiry"
        onSubmit={handleSubmit(submitInquiry, showValidationErrors)}
        noValidate
      >
        <FieldGroup>
          <FieldLabel htmlFor="op-name">성함</FieldLabel>
          <TextInput
            id="op-name"
            autoComplete="name"
            aria-invalid={Boolean(errors.name)}
            disabled={isSubmitting}
            maxLength={100}
            required
            {...register('name', { onChange: () => clearErrors('name') })}
          />
        </FieldGroup>
        <FieldGroup>
          <FieldLabel htmlFor="op-contact">연락처</FieldLabel>
          <TextInput
            id="op-contact"
            autoComplete="tel"
            aria-invalid={Boolean(errors.contact)}
            disabled={isSubmitting}
            maxLength={200}
            required
            {...register('contact', { onChange: () => clearErrors('contact') })}
          />
        </FieldGroup>
        <FieldGroup>
          <FieldLabel htmlFor="op-message">문의내용</FieldLabel>
          <TextArea
            id="op-message"
            aria-invalid={Boolean(errors.content)}
            disabled={isSubmitting}
            maxLength={4000}
            required
            {...register('content', { onChange: () => clearErrors('content') })}
          />
        </FieldGroup>
      </Form>
      <SubmitButton type="submit" form="operations-inquiry" disabled={isSubmitting}>
        {isSubmitting ? '문의 접수 중...' : '문의하기'}
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
