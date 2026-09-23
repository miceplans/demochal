'use client';
import { useState, type ChangeEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import styled from '@emotion/styled';
import { colors as c, shadows as s, mobile } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { StepProgressBar } from '@/components/ui/StepProgressBar';
import { useToast } from '@/components/common/Toast';
import {
  BizGlobalStyles,
  Logo,
  PrimaryButton,
  OutlineButton,
  useBizHref,
} from '@/components/biz/BizShell';

const stepLabels = ['약관 동의', '계정 정보', '기관 인증'];

const agreements = [
  { value: 'privacy', label: '개인정보처리방침' },
  { value: 'business', label: '사업자 이용정보 동의' },
];

const orgTypes = [
  { value: 'company', label: '일반 기업', uploadLabel: '사업자 등록증을 업로드 해 주세요' },
  { value: 'school', label: '학교', uploadLabel: '관련 서류를 업로드해주세요' },
] as const;
type OrgType = (typeof orgTypes)[number]['value'];

export function BizLoginFlow() {
  const router = useRouter();
  const hrefOf = useBizHref();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [agreed, setAgreed] = useState<string[]>([]);
  const [orgType, setOrgType] = useState<OrgType>('company');
  const [docFileName, setDocFileName] = useState<string | null>(null);
  const toggle = (v: string) =>
    setAgreed((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
  const pickDoc = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDocFileName(file.name);
  };
  // TODO: 이메일/휴대폰 인증 API 연동 — 인증 발송·확인 엔드포인트를 server/docs/openapi.yaml에 정의한 뒤
  // @semochal/api-client로 호출한다. https://orval.dev/guides/react-query
  const requestVerification = (target: string) => toast.info(`${target} 인증은 준비 중이에요.`);
  // TODO: 회원가입(/auth/register) + 서류 업로드(/files/presign → private 버킷) + /verifications 연동.
  const completeVerification = () => {
    if (!docFileName) {
      toast.error('서류를 첨부해주세요.');
      return;
    }
    toast.success('기관 인증 요청이 접수됐어요.');
    router.push(hrefOf('/dashboard'));
  };
  const uploadLabel = orgTypes.find((o) => o.value === orgType)?.uploadLabel ?? '';

  return (
    <Wrap>
      {BizGlobalStyles}
      <Card>
        <Content>
          <Header>
            <Logo size={31} />
            <ProgressWrap>
              <StepProgressBar steps={stepLabels} currentStep={step} aria-label="가입 단계" />
            </ProgressWrap>
          </Header>
          {step === 0 && (
            <CheckList aria-label="약관 동의">
              {agreements.map(({ value, label }) => (
                <CheckRow key={value}>
                  <HiddenInput
                    type="checkbox"
                    checked={agreed.includes(value)}
                    onChange={() => toggle(value)}
                  />
                  <CheckBox aria-hidden>
                    <CheckIcon src="/assets/icons/biz-checkbox-check.svg" alt="" />
                  </CheckBox>
                  {label}
                </CheckRow>
              ))}
            </CheckList>
          )}
          {step === 1 && (
            <Form aria-label="계정 정보">
              <FormField label="성함을 입력해주세요">
                <TextInput name="name" autoComplete="name" />
              </FormField>
              <FormField label="이메일을 입력해주세요">
                <InputRow>
                  <TextInput
                    type="email"
                    name="email"
                    autoComplete="email"
                    placeholder="이메일을 입력해주세요"
                  />
                  <VerifyButton type="button" onClick={() => requestVerification('이메일')}>
                    인증하기
                  </VerifyButton>
                </InputRow>
              </FormField>
              <FormField label="전화번호를 입력해주세요">
                <InputRow>
                  <TextInput
                    type="tel"
                    name="phone"
                    autoComplete="tel"
                    inputMode="tel"
                    placeholder="전화번호 인증하기"
                  />
                  <VerifyButton type="button" onClick={() => requestVerification('전화번호')}>
                    인증하기
                  </VerifyButton>
                </InputRow>
              </FormField>
              <FormField label="아이디를 입력해주세요">
                <TextInput name="username" autoComplete="username" placeholder="아이디입력" />
              </FormField>
              <FormField label="비밀번호를 입력해주세요">
                <TextInput
                  type="password"
                  name="password"
                  autoComplete="new-password"
                  placeholder="비밀번호를 입력해주세요"
                />
                <TextInput
                  type="password"
                  name="passwordConfirm"
                  autoComplete="new-password"
                  placeholder="비밀번호를 입력해주세요"
                  aria-label="비밀번호 확인"
                />
              </FormField>
            </Form>
          )}
          {step === 2 && (
            <Form aria-label="기관 인증">
              <SelectWrap>
                <Select
                  aria-label="기관 유형"
                  value={orgType}
                  onChange={(e) => setOrgType(e.target.value as OrgType)}
                >
                  {orgTypes.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
                <Chevron src="/assets/icons/biz-select-chevron.svg" alt="" aria-hidden />
              </SelectWrap>
              <FieldBox>
                <FieldLabel>{uploadLabel}</FieldLabel>
                <UploadBox>
                  <HiddenInput type="file" accept="image/*,.pdf" onChange={pickDoc} />
                  <UploadIcon src="/assets/icons/biz-upload-cloud.svg" alt="" aria-hidden />
                  <UploadText>{docFileName ?? '파일 찾기'}</UploadText>
                </UploadBox>
              </FieldBox>
            </Form>
          )}
        </Content>
        <Actions single={step === 0}>
          {step > 0 && (
            <ActionOutline type="button" onClick={() => setStep((v) => v - 1)}>
              이전
            </ActionOutline>
          )}
          {step < 2 ? (
            <ActionPrimary
              type="button"
              disabled={step === 0 && agreed.length < agreements.length}
              onClick={() => setStep((v) => v + 1)}
            >
              다음
            </ActionPrimary>
          ) : (
            <ActionPrimary type="button" onClick={completeVerification}>
              다음
            </ActionPrimary>
          )}
        </Actions>
      </Card>
    </Wrap>
  );
}

function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <FieldBox>
      <FieldLabel>{label}</FieldLabel>
      {children}
    </FieldBox>
  );
}

const Wrap = styled.div({
  minHeight: '100vh',
  display: 'flex',
  justifyContent: 'center',
  padding: '80px 120px',
  background: c.white,
  [mobile]: { padding: '40px 16px' },
});
const Card = styled.div({
  width: '100%',
  maxWidth: 426,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  gap: 60,
});
const Content = styled.div({
  display: 'flex',
  flexDirection: 'column',
  gap: 160,
  [mobile]: { gap: 64 },
});
const Header = styled.div({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 32,
});
const ProgressWrap = styled.div({ width: '100%' });
const CheckList = styled.div({ display: 'flex', flexDirection: 'column', gap: 8 });
const HiddenInput = styled.input({
  position: 'absolute',
  width: 1,
  height: 1,
  opacity: 0,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
});
const CheckBox = styled.span({
  position: 'relative',
  width: 16,
  height: 16,
  flexShrink: 0,
  borderRadius: 3,
  border: `1px solid ${c.gray200}`,
  background: c.white,
});
const CheckIcon = styled.img({
  position: 'absolute',
  top: -0.84,
  left: -1.27,
  width: 16,
  height: 16,
  opacity: 0,
});
const CheckRow = styled.label({
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  width: 'fit-content',
  ...textStyle.mBodyDetail,
  color: c.gray700,
  cursor: 'pointer',
  'input:checked + span': { background: c.primary, borderColor: c.primary },
  'input:checked + span img': { opacity: 1 },
  'input:focus-visible + span': { boxShadow: s.focus },
});
const Form = styled.div({ display: 'flex', flexDirection: 'column', gap: 32 });
const FieldBox = styled.div({ display: 'flex', flexDirection: 'column', gap: 10 });
const FieldLabel = styled.p({ margin: 0, ...textStyle.mBodyText, color: c.gray900 });
const InputRow = styled.div({ display: 'flex', gap: 8, '& > input': { flex: 1 } });
const TextInput = styled.input({
  width: '100%',
  minWidth: 0,
  flexShrink: 0,
  height: 44,
  border: `0.5px solid ${c.gray200}`,
  borderRadius: 8,
  padding: '0 14px',
  background: c.white,
  ...textStyle.mListText,
  color: c.gray900,
  '&::placeholder': { color: c.gray500 },
  '&:focus': { outline: 'none', boxShadow: s.focus },
});
const VerifyButton = styled(PrimaryButton)({
  width: 94,
  flexShrink: 0,
  ...textStyle.mFeatureTitle,
});
const SelectWrap = styled.div({ position: 'relative' });
const Select = styled.select({
  width: '100%',
  height: 44,
  border: `0.5px solid ${c.gray200}`,
  borderRadius: 8,
  padding: '0 46px 0 14px',
  background: c.white,
  appearance: 'none',
  ...textStyle.mBodyText,
  color: c.gray900,
  cursor: 'pointer',
  '&:focus': { outline: 'none', boxShadow: s.focus },
});
const Chevron = styled.img({
  position: 'absolute',
  top: 10,
  right: 14,
  width: 24,
  height: 24,
  pointerEvents: 'none',
});
const UploadBox = styled.label({
  position: 'relative',
  height: 160,
  padding: 8,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 4,
  border: `2px dashed ${c.lightBlue}`,
  borderRadius: 20,
  background: '#f8f8f8',
  cursor: 'pointer',
  '&:focus-within': { boxShadow: s.focus },
});
const UploadIcon = styled.img({ width: 57.3223, height: 36 });
const UploadText = styled.span({
  ...textStyle.mInfoText,
  color: c.gray500,
  maxWidth: '100%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});
const Actions = styled('div', { shouldForwardProp: (prop) => prop !== 'single' })<{
  single: boolean;
}>(({ single }) => ({
  display: 'flex',
  justifyContent: single ? 'flex-end' : 'space-between',
}));
const ActionPrimary = styled(PrimaryButton)({
  width: 94,
  height: 37,
  ...textStyle.mFeatureTitle,
});
const ActionOutline = styled(OutlineButton)({
  width: 94,
  height: 37,
  ...textStyle.mCounterText,
});
