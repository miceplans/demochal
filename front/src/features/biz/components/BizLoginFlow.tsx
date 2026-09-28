'use client';
import { useState, type ChangeEvent, type ComponentProps, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import styled from '@emotion/styled';
import { ApiError, generated } from '@semochal/api-client';
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
] as const;
type AgreementKey = (typeof agreements)[number]['value'];

const orgTypes = [
  { value: '기업', label: '일반 기업', uploadLabel: '사업자 등록증을 업로드 해 주세요' },
  { value: '학교', label: '학교', uploadLabel: '관련 서류를 업로드해주세요' },
  { value: '비영리', label: '비영리 단체', uploadLabel: '관련 서류를 업로드해주세요' },
  { value: '협회', label: '협회', uploadLabel: '관련 서류를 업로드해주세요' },
] as const;
type OrgType = (typeof orgTypes)[number]['value'];

// server/src/modules/files/dto/request-upload.dto.ts와 동일한 제약
const UPLOAD_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const;
type UploadType = (typeof UPLOAD_TYPES)[number];
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_PATTERN = /^[a-z0-9_]{4,20}$/;
const PHONE_PATTERN = /^01\d{8,9}$/;

type Channel = 'email' | 'phone';
interface ContactVerification {
  id: string | null;
  code: string;
  verified: boolean;
  busy: boolean;
}
const emptyVerification: ContactVerification = { id: null, code: '', verified: false, busy: false };

function apiErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError && error.body && typeof error.body === 'object') {
    const message = (error.body as { message?: unknown }).message;
    if (typeof message === 'string') return message;
    if (Array.isArray(message) && typeof message[0] === 'string') return message[0];
  }
  return fallback;
}

export function BizLoginFlow() {
  const router = useRouter();
  const hrefOf = useBizHref();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [agreed, setAgreed] = useState<AgreementKey[]>([]);
  const [account, setAccount] = useState({
    name: '',
    email: '',
    phone: '',
    username: '',
    password: '',
    passwordConfirm: '',
  });
  const [verification, setVerification] = useState<Record<Channel, ContactVerification>>({
    email: emptyVerification,
    phone: emptyVerification,
  });
  const [orgType, setOrgType] = useState<OrgType>('기업');
  const [docFile, setDocFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // 제출 도중 실패하면 다시 눌렀을 때 이미 끝난 단계(가입/기관 등록)를 건너뛴다.
  const [registered, setRegistered] = useState(false);
  const [businessId, setBusinessId] = useState<string | null>(null);

  const toggle = (v: AgreementKey) =>
    setAgreed((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
  const setField = (key: keyof typeof account) => (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setAccount((prev) => ({ ...prev, [key]: value }));
    // 인증한 뒤 값을 바꾸면 인증을 다시 받아야 한다.
    if (key === 'email' || key === 'phone') {
      setVerification((prev) => ({ ...prev, [key]: emptyVerification }));
    }
  };
  const patchVerification = (channel: Channel, patch: Partial<ContactVerification>) =>
    setVerification((prev) => ({ ...prev, [channel]: { ...prev[channel], ...patch } }));

  const contactTarget = (channel: Channel) =>
    channel === 'email' ? account.email.trim() : account.phone.replace(/\D/g, '');

  const requestVerification = async (channel: Channel) => {
    const target = contactTarget(channel);
    if (channel === 'email' ? !EMAIL_PATTERN.test(target) : !PHONE_PATTERN.test(target)) {
      toast.error(channel === 'email' ? '이메일을 확인해주세요.' : '휴대폰 번호를 확인해주세요.');
      return;
    }
    patchVerification(channel, { busy: true });
    try {
      const res = await generated.requestContactVerification({ channel, target });
      if (res.status !== 201) throw new Error('verification request failed');
      const { data } = res;
      patchVerification(channel, { id: data.id, code: '', verified: false });
      toast.success(
        '인증번호를 보냈어요.',
        data.devCode ? `개발 환경 인증번호: ${data.devCode}` : '5분 안에 입력해주세요.',
      );
    } catch (error) {
      toast.error(apiErrorMessage(error, '인증번호를 보내지 못했어요.'));
    } finally {
      patchVerification(channel, { busy: false });
    }
  };

  const confirmVerification = async (channel: Channel) => {
    const { id, code } = verification[channel];
    if (!id || !/^\d{6}$/.test(code)) {
      toast.error('인증번호 6자리를 입력해주세요.');
      return;
    }
    patchVerification(channel, { busy: true });
    try {
      await generated.confirmContactVerification(id, { code });
      patchVerification(channel, { verified: true });
      toast.success(
        channel === 'email' ? '이메일 인증이 완료됐어요.' : '휴대폰 인증이 완료됐어요.',
      );
    } catch (error) {
      toast.error(apiErrorMessage(error, '인증에 실패했어요.'));
    } finally {
      patchVerification(channel, { busy: false });
    }
  };

  const validateAccount = () => {
    if (!account.name.trim()) return '성함을 입력해주세요.';
    if (!EMAIL_PATTERN.test(account.email.trim())) return '이메일을 확인해주세요.';
    if (!PHONE_PATTERN.test(account.phone.replace(/\D/g, ''))) return '휴대폰 번호를 확인해주세요.';
    if (!USERNAME_PATTERN.test(account.username)) {
      return '아이디는 영문 소문자·숫자·_ 4~20자로 입력해주세요.';
    }
    if (account.password.length < 8) return '비밀번호는 8자 이상 입력해주세요.';
    if (account.password !== account.passwordConfirm) return '비밀번호가 일치하지 않아요.';
    return null;
  };
  const goToVerificationStep = () => {
    const error = validateAccount();
    if (error) {
      toast.error(error);
      return;
    }
    setStep(2);
  };

  const pickDoc = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!UPLOAD_TYPES.includes(file.type as UploadType)) {
      toast.error('JPG, PNG, WEBP, PDF 파일만 올릴 수 있어요.');
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error('10MB 이하 파일만 올릴 수 있어요.');
      return;
    }
    setDocFile(file);
  };

  const uploadDocument = async (file: File) => {
    const { data: presigned } = await generated.requestPresignedUpload({
      bucket: 'private',
      contentType: file.type as UploadType,
      fileName: file.name,
      sizeBytes: file.size,
    });
    if (!presigned.uploadUrl || !presigned.fileId) throw new Error('presign failed');
    // S3 presigned URL로 직접 PUT — API 호출이 아니므로 api-client를 거치지 않는다.
    const uploaded = await fetch(presigned.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file,
    });
    if (!uploaded.ok) throw new Error('upload failed');
    await generated.finalizeUpload(presigned.fileId);
    return presigned.fileId;
  };

  const submit = async () => {
    if (!docFile) {
      toast.error('서류를 첨부해주세요.');
      return;
    }
    setSubmitting(true);
    try {
      if (!registered) {
        try {
          await generated.register({
            name: account.name.trim(),
            email: account.email.trim(),
            password: account.password,
            username: account.username,
            phone: account.phone.replace(/\D/g, ''),
            agreements: agreed,
            ...(verification.email.verified && verification.email.id
              ? { emailVerificationId: verification.email.id }
              : {}),
            ...(verification.phone.verified && verification.phone.id
              ? { phoneVerificationId: verification.phone.id }
              : {}),
          });
        } catch (error) {
          if (error instanceof ApiError && error.status === 409) {
            toast.error('이미 가입된 이메일 또는 아이디예요.');
            setStep(1);
            return;
          }
          throw error;
        }
        setRegistered(true);
      }
      let ownedBusinessId = businessId;
      if (!ownedBusinessId) {
        const { data: business } = await generated.registerBusiness({ type: orgType });
        if (!business.id) throw new Error('business registration failed');
        ownedBusinessId = business.id;
        setBusinessId(ownedBusinessId);
      }
      const documentFileId = await uploadDocument(docFile);
      await generated.submitVerification({ businessId: ownedBusinessId, documentFileId });
      toast.success('가입이 완료됐어요.', '기관 인증 결과는 알림으로 알려드릴게요.');
      router.push(hrefOf('/dashboard'));
    } catch (error) {
      toast.error(
        apiErrorMessage(error, '가입을 완료하지 못했어요.'),
        '잠시 후 다시 시도해주세요.',
      );
    } finally {
      setSubmitting(false);
    }
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
                <TextInput
                  name="name"
                  autoComplete="name"
                  value={account.name}
                  onChange={setField('name')}
                />
              </FormField>
              <FormField label="이메일을 입력해주세요">
                <ContactInput
                  channel="email"
                  type="email"
                  autoComplete="email"
                  placeholder="이메일을 입력해주세요"
                  value={account.email}
                  onChange={setField('email')}
                  state={verification.email}
                  onRequest={() => void requestVerification('email')}
                  onCodeChange={(code) => patchVerification('email', { code })}
                  onConfirm={() => void confirmVerification('email')}
                />
              </FormField>
              <FormField label="전화번호를 입력해주세요">
                <ContactInput
                  channel="phone"
                  type="tel"
                  autoComplete="tel"
                  inputMode="tel"
                  placeholder="전화번호 인증하기"
                  value={account.phone}
                  onChange={setField('phone')}
                  state={verification.phone}
                  onRequest={() => void requestVerification('phone')}
                  onCodeChange={(code) => patchVerification('phone', { code })}
                  onConfirm={() => void confirmVerification('phone')}
                />
              </FormField>
              <FormField label="아이디를 입력해주세요">
                <TextInput
                  name="username"
                  autoComplete="username"
                  placeholder="아이디입력"
                  value={account.username}
                  onChange={setField('username')}
                />
              </FormField>
              <FormField label="비밀번호를 입력해주세요">
                <TextInput
                  type="password"
                  name="password"
                  autoComplete="new-password"
                  placeholder="비밀번호를 입력해주세요"
                  value={account.password}
                  onChange={setField('password')}
                />
                <TextInput
                  type="password"
                  name="passwordConfirm"
                  autoComplete="new-password"
                  placeholder="비밀번호를 입력해주세요"
                  aria-label="비밀번호 확인"
                  value={account.passwordConfirm}
                  onChange={setField('passwordConfirm')}
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
                  disabled={!!businessId}
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
                  <HiddenInput type="file" accept={UPLOAD_TYPES.join(',')} onChange={pickDoc} />
                  <UploadIcon src="/assets/icons/biz-upload-cloud.svg" alt="" aria-hidden />
                  <UploadText>{docFile?.name ?? '파일 찾기'}</UploadText>
                </UploadBox>
              </FieldBox>
            </Form>
          )}
        </Content>
        <Actions single={step === 0 || (step === 2 && registered)}>
          {step > 0 && !(step === 2 && registered) && (
            <ActionOutline type="button" onClick={() => setStep((v) => v - 1)}>
              이전
            </ActionOutline>
          )}
          {step === 0 && (
            <ActionPrimary
              type="button"
              disabled={agreed.length < agreements.length}
              onClick={() => setStep(1)}
            >
              다음
            </ActionPrimary>
          )}
          {step === 1 && (
            <ActionPrimary type="button" onClick={goToVerificationStep}>
              다음
            </ActionPrimary>
          )}
          {step === 2 && (
            <ActionPrimary type="button" disabled={submitting} onClick={() => void submit()}>
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

function ContactInput({
  channel,
  state,
  onRequest,
  onCodeChange,
  onConfirm,
  ...inputProps
}: {
  channel: Channel;
  state: ContactVerification;
  onRequest: () => void;
  onCodeChange: (code: string) => void;
  onConfirm: () => void;
} & ComponentProps<typeof TextInput>) {
  return (
    <>
      <InputRow>
        <TextInput name={channel} {...inputProps} />
        <VerifyButton type="button" disabled={state.busy || state.verified} onClick={onRequest}>
          {state.verified ? '인증 완료' : state.id ? '재전송' : '인증하기'}
        </VerifyButton>
      </InputRow>
      {state.id && !state.verified && (
        <InputRow>
          <TextInput
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="인증번호 6자리"
            aria-label={channel === 'email' ? '이메일 인증번호' : '휴대폰 인증번호'}
            value={state.code}
            onChange={(e) => onCodeChange(e.target.value.replace(/\D/g, ''))}
          />
          <VerifyButton type="button" disabled={state.busy} onClick={onConfirm}>
            확인
          </VerifyButton>
        </InputRow>
      )}
    </>
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
