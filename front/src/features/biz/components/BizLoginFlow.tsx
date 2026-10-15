'use client';
import { useState, type ChangeEvent, type ReactNode } from 'react';
import { Dropdown } from '@/components/ui/Dropdown';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styled from '@emotion/styled';
import { ApiError, generated } from '@semochal/api-client';
import { apiErrorMessage } from '@/lib/api-error';
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

const stepLabels = ['약관 동의', '계정 정보', '기관 정보'];

const agreements = [
  { value: 'privacy', label: '개인정보처리방침' },
  { value: 'business', label: '사업자 이용정보 동의' },
] as const;
type AgreementKey = (typeof agreements)[number]['value'];

const orgTypes = [
  { value: '기업', label: '일반 기업' },
  { value: '학교', label: '학교' },
  { value: '비영리', label: '비영리 단체' },
  { value: '협회', label: '협회' },
] as const;
type OrgType = (typeof orgTypes)[number]['value'];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_PATTERN = /^[a-z0-9_]{4,20}$/;

export function BizSignupFlow() {
  const router = useRouter();
  const hrefOf = useBizHref();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [agreed, setAgreed] = useState<AgreementKey[]>([]);
  const [account, setAccount] = useState({
    name: '',
    email: '',
    username: '',
    password: '',
    passwordConfirm: '',
  });
  const [orgType, setOrgType] = useState<OrgType>('기업');
  const [submitting, setSubmitting] = useState(false);
  // 제출 도중 실패하면 다시 눌렀을 때 이미 끝난 단계(가입/기관 등록)를 건너뛴다.
  const [registered, setRegistered] = useState(false);
  const [businessId, setBusinessId] = useState<string | null>(null);

  const toggle = (v: AgreementKey) =>
    setAgreed((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
  const setField = (key: keyof typeof account) => (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setAccount((prev) => ({ ...prev, [key]: value }));
  };

  const validateAccount = () => {
    if (!account.name.trim()) return '성함을 입력해주세요.';
    if (!EMAIL_PATTERN.test(account.email.trim())) return '이메일을 확인해주세요.';
    if (!USERNAME_PATTERN.test(account.username)) {
      return '아이디는 영문 소문자·숫자·_ 4~20자로 입력해주세요.';
    }
    if (account.password.length < 8) return '비밀번호는 8자 이상 입력해주세요.';
    if (account.password !== account.passwordConfirm) return '비밀번호가 일치하지 않아요.';
    return null;
  };
  const goToOrgStep = () => {
    const error = validateAccount();
    if (error) {
      toast.error(error);
      return;
    }
    setStep(2);
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      if (!registered) {
        try {
          await generated.register({
            name: account.name.trim(),
            email: account.email.trim(),
            password: account.password,
            username: account.username,
            agreements: agreed,
          });
        } catch (error) {
          if (error instanceof ApiError && error.status === 409) {
            toast.error('이미 가입된 이메일 또는 아이디예요. 로그인 페이지로 이동할게요.');
            router.replace(hrefOf('/login'));
            return;
          }
          throw error;
        }
        setRegistered(true);
      }
      if (!businessId) {
        const { data: business } = await generated.registerBusiness({ type: orgType });
        if (!business.id) throw new Error('business registration failed');
        setBusinessId(business.id);
      }
      toast.success('가입이 완료됐어요.');
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
          <StepBody key={step}>
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
                  <TextInput
                    type="email"
                    name="email"
                    autoComplete="email"
                    placeholder="이메일을 입력해주세요"
                    value={account.email}
                    onChange={setField('email')}
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
              <Form aria-label="기관 정보">
                <Dropdown
                  aria-label="기관 유형"
                  options={orgTypes.map((o) => ({ value: o.value, label: o.label }))}
                  value={orgType}
                  disabled={!!businessId}
                  onChange={(value) => setOrgType(value as OrgType)}
                />
              </Form>
            )}
          </StepBody>
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
            <ActionPrimary type="button" onClick={goToOrgStep}>
              다음
            </ActionPrimary>
          )}
          {step === 2 && (
            <ActionPrimary type="button" disabled={submitting} onClick={() => void submit()}>
              다음
            </ActionPrimary>
          )}
        </Actions>
        <ExistingAccount>
          이미 계정이 있나요?{' '}
          <ExistingAccountLink href={hrefOf('/login')}>로그인</ExistingAccountLink>
        </ExistingAccount>
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
// BIZ 랜딩(BizLanding)의 리빌과 동일한 베지어로, 인터랙티브 전환에 맞춰 400ms 만에 스텝 콘텐츠가 아래에서 올라온다.
const StepBody = styled.div({
  animation: 'semo-biz-step-in 400ms cubic-bezier(0.22, 1, 0.36, 1) both',
  '@keyframes semo-biz-step-in': {
    from: { opacity: 0, transform: 'translateY(28px)' },
    to: { opacity: 1, transform: 'none' },
  },
  '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
});
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
  border: `0.5px solid ${c.gray200}`,
  background: c.white,
  transition: 'background 150ms ease, border-color 150ms ease, transform 120ms ease',
});
const CheckIcon = styled.img({
  position: 'absolute',
  top: -0.84,
  left: -1.27,
  width: 16,
  height: 16,
  opacity: 0,
  transform: 'scale(0.4)',
  transition: 'opacity 140ms ease, transform 240ms cubic-bezier(0.22, 1, 0.36, 1)',
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
  'input:checked + span img': { opacity: 1, transform: 'scale(1)' },
  'input:focus-visible + span': { boxShadow: s.focus },
  '&:hover > span': { borderColor: c.gray300 },
  '&:hover > input:checked + span': { borderColor: c.primary },
  '&:active > span': { transform: 'scale(0.9)' },
});
const Form = styled.div({ display: 'flex', flexDirection: 'column', gap: 32 });
const FieldBox = styled.div({ display: 'flex', flexDirection: 'column', gap: 10 });
const FieldLabel = styled.p({ margin: 0, ...textStyle.mBodyText, color: c.gray900 });
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
  transition: 'transform 100ms ease',
  '&:active:not(:disabled)': { transform: 'scale(0.96)' },
});
const ActionOutline = styled(OutlineButton)({
  width: 94,
  height: 37,
  ...textStyle.mCounterText,
  transition: 'transform 100ms ease',
  '&:active:not(:disabled)': { transform: 'scale(0.96)' },
});
const ExistingAccount = styled.p({
  margin: 0,
  textAlign: 'center',
  ...textStyle.mInfoText,
  color: c.gray700,
});
const ExistingAccountLink = styled(Link)({
  color: c.primary,
  textDecoration: 'underline',
  textUnderlineOffset: 3,
});
