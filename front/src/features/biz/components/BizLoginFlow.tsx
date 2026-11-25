'use client';
import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from 'react';
import { Dropdown } from '@/components/ui/Dropdown';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styled from '@emotion/styled';
import { ApiError, generated } from '@semochal/api-client';
import { apiErrorMessage } from '@/lib/api-error';
import { clearFormDraft, readFormDraft, useFormDraftSaver } from '@/lib/form-draft';
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

type AgreementKey = 'terms' | 'privacy' | 'business';
const agreements: { value: AgreementKey; label: string; href?: string }[] = [
  { value: 'terms', label: '이용약관 동의', href: '/terms' },
  { value: 'privacy', label: '개인정보처리방침 동의', href: '/privacy' },
  { value: 'business', label: '사업자 이용정보 동의' },
];

const orgTypes = [
  { value: '기업', label: '일반 기업' },
  { value: '학교', label: '학교' },
  { value: '비영리', label: '비영리 단체' },
  { value: '협회', label: '협회' },
] as const;
type OrgType = (typeof orgTypes)[number]['value'];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 사업자등록번호는 숫자 10자리(000-00-00000)로 표시하고, 서버에는 숫자만 보낸다.
const formatRegistrationNumber = (value: string) => {
  const d = value.replace(/\D/g, '').slice(0, 10);
  return [d.slice(0, 3), d.slice(3, 5), d.slice(5)].filter(Boolean).join('-');
};

// 가입 초안은 계정 비밀번호를 절대 포함하지 않는다 — persisted 객체를 필드별로 직접 만들어
// account state를 spread하는 일이 없도록 한다.
type SignupDraft = {
  step: number;
  agreed: AgreementKey[];
  accountName: string;
  accountEmail: string;
  org: { name: string; registrationNumber: string; phone: string; email: string };
  orgType: OrgType;
};

const SIGNUP_DRAFT_KEY = 'biz-signup';
const EMPTY_ORG = { name: '', registrationNumber: '', phone: '', email: '' };
const SIGNUP_DRAFT_BASELINE: SignupDraft = {
  step: 0,
  agreed: [],
  accountName: '',
  accountEmail: '',
  org: EMPTY_ORG,
  orgType: '기업',
};

const isSignupDraft = (value: unknown): value is SignupDraft => {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (typeof v.step !== 'number' || v.step < 0 || v.step > 2) return false;
  if (
    !Array.isArray(v.agreed) ||
    !v.agreed.every((a) => agreements.some((agreement) => agreement.value === a))
  )
    return false;
  if (typeof v.accountName !== 'string' || typeof v.accountEmail !== 'string') return false;
  if (!v.org || typeof v.org !== 'object') return false;
  const org = v.org as Record<string, unknown>;
  if (
    typeof org.name !== 'string' ||
    typeof org.registrationNumber !== 'string' ||
    typeof org.phone !== 'string' ||
    typeof org.email !== 'string'
  )
    return false;
  return orgTypes.some((type) => type.value === v.orgType);
};

export function BizSignupFlow() {
  const router = useRouter();
  const hrefOf = useBizHref();
  const toast = useToast();
  // SSR 프리렌더와 클라이언트 hydration 렌더가 일치하도록 모든 state는 pristine으로 시작하고,
  // 초안은 마운트 effect에서 복원한다.
  const [step, setStep] = useState(0);
  const [agreed, setAgreed] = useState<AgreementKey[]>([]);
  const [account, setAccount] = useState({
    name: '',
    email: '',
    // 비밀번호는 초안에 저장하지 않으므로 항상 빈 값에서 시작한다.
    password: '',
    passwordConfirm: '',
  });
  const [org, setOrg] = useState(EMPTY_ORG);
  const [orgType, setOrgType] = useState<OrgType>('기업');
  const [submitting, setSubmitting] = useState(false);
  // 가입 완료 후에는 초안 저장기를 멈춰, 남아 있는 디바운스가 지워진 초안을 다시 쓰지 않게 한다.
  const [completed, setCompleted] = useState(false);
  // 초안 복원이 끝나기 전에는 저장기를 렌더링하지 않는다 — 복원 전 pristine 값으로 저장된
  // 초안을 지우거나 덮어쓰는 것을 막는다.
  const [restored, setRestored] = useState(false);
  // 제출 도중 실패하면 다시 눌렀을 때 이미 끝난 단계(가입/기관 등록)를 건너뛴다.
  const [registered, setRegistered] = useState(false);
  const [businessId, setBusinessId] = useState<string | null>(null);

  // 마운트 시 한 번만 초안을 읽어 복원한다 — hydration 일치를 위해 렌더가 아니라 effect에서 적용한다.
  useEffect(() => {
    const draft = readFormDraft<SignupDraft>(SIGNUP_DRAFT_KEY, isSignupDraft);
    if (draft) {
      // localStorage(외부 시스템)에서 읽은 초안을 hydration 이후 한 번만 동기화한다.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStep(draft.step);
      setAgreed(draft.agreed);
      // 비밀번호는 초안에 없으므로 이름·이메일만 복원한다.
      setAccount((prev) => ({ ...prev, name: draft.accountName, email: draft.accountEmail }));
      setOrg(draft.org);
      setOrgType(draft.orgType);
    }
    setRestored(true);
  }, []);

  // 비밀번호는 절대 초안에 포함하지 않는다 — 저장할 필드를 하나씩 골라 객체를 만든다.
  const draftValue = useMemo<SignupDraft>(
    () => ({
      step,
      agreed,
      accountName: account.name,
      accountEmail: account.email,
      org,
      orgType,
    }),
    [step, agreed, account.name, account.email, org, orgType],
  );

  const toggle = (v: AgreementKey) =>
    setAgreed((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
  const setField = (key: keyof typeof account) => (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setAccount((prev) => ({ ...prev, [key]: value }));
  };

  const validateAccount = () => {
    if (!account.name.trim()) return '성함을 입력해주세요.';
    if (!EMAIL_PATTERN.test(account.email.trim())) return '이메일을 확인해주세요.';
    if (account.password.length < 8) return '비밀번호는 8자 이상 입력해주세요.';
    if (account.password !== account.passwordConfirm) return '비밀번호가 일치하지 않아요.';
    return null;
  };
  const setOrgField = (key: keyof typeof org) => (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setOrg((prev) => ({ ...prev, [key]: value }));
  };
  const validateOrg = () => {
    if (!org.name.trim()) return '사명/단체명을 입력해주세요.';
    const number = org.registrationNumber.replace(/\D/g, '');
    if ((orgType === '기업' || number.length > 0) && number.length !== 10)
      return '사업자 등록 번호 10자리를 입력해주세요.';
    if (!org.phone.trim()) return '문의 번호를 입력해주세요.';
    if (!EMAIL_PATTERN.test(org.email.trim())) return '문의 이메일을 확인해주세요.';
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
    // 초안 복원으로 기관 단계에 바로 진입한 경우 비밀번호는 복원되지 않으므로 계정 정보를 다시 확인한다.
    if (!registered) {
      const accountError = validateAccount();
      if (accountError) {
        toast.error(accountError);
        setStep(1);
        return;
      }
    }
    if (!businessId) {
      const error = validateOrg();
      if (error) {
        toast.error(error);
        return;
      }
    }
    setSubmitting(true);
    let lookupUnavailable = false;
    try {
      if (!registered) {
        try {
          await generated.register({
            name: account.name.trim(),
            email: account.email.trim(),
            password: account.password,
            agreements: agreed,
          });
        } catch (error) {
          if (error instanceof ApiError && error.status === 409) {
            toast.error('이미 가입된 이메일이에요. 로그인 페이지로 이동할게요.');
            router.replace(hrefOf('/login'));
            return;
          }
          throw error;
        }
        setRegistered(true);
      }
      if (!businessId) {
        const { data: business } = await generated.registerBusiness({
          type: orgType,
          name: org.name.trim(),
          registrationNumber: org.registrationNumber.replace(/\D/g, '') || undefined,
          phone: org.phone.trim(),
          email: org.email.trim(),
        });
        if (!business.id) throw new Error('business registration failed');
        lookupUnavailable = business.registrationLookupUnavailable === true;
        setBusinessId(business.id);
      }
      // 가입이 모두 끝났으므로 초안을 지우고 저장기를 멈춘다.
      setCompleted(true);
      clearFormDraft(SIGNUP_DRAFT_KEY);
      toast.success(
        lookupUnavailable
          ? '가입이 완료됐어요. 사업자번호 조회는 일시적으로 이용할 수 없었어요.'
          : '가입이 완료됐어요.',
      );
      router.replace(hrefOf('/login'));
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
      {restored && !completed ? (
        <DraftSaver
          draftKey={SIGNUP_DRAFT_KEY}
          value={draftValue}
          baseline={SIGNUP_DRAFT_BASELINE}
        />
      ) : null}
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
                {agreements.map(({ value, label, href }) => (
                  <CheckRow key={value}>
                    <CheckLabel>
                      <HiddenInput
                        type="checkbox"
                        aria-label={href ? label : undefined}
                        checked={agreed.includes(value)}
                        onChange={() => toggle(value)}
                      />
                      <CheckBox aria-hidden>
                        <CheckIcon src="/assets/icons/biz-checkbox-check.svg" alt="" />
                      </CheckBox>
                      {!href && label}
                    </CheckLabel>
                    {href && <ConsentLink href={hrefOf(href)}>{label}</ConsentLink>}
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
                <FormField label="유형">
                  <Dropdown
                    aria-label="기관 유형"
                    options={orgTypes.map((o) => ({ value: o.value, label: o.label }))}
                    value={orgType}
                    disabled={!!businessId}
                    onChange={(value) => setOrgType(value as OrgType)}
                  />
                </FormField>
                <FormField label="사명/단체명">
                  <TextInput
                    name="orgName"
                    autoComplete="organization"
                    disabled={!!businessId}
                    value={org.name}
                    onChange={setOrgField('name')}
                  />
                </FormField>
                <FormField
                  label={orgType === '기업' ? '사업자 등록 번호' : '사업자 등록 번호 (선택)'}
                >
                  <TextInput
                    name="orgRegistrationNumber"
                    inputMode="numeric"
                    autoComplete="off"
                    disabled={!!businessId}
                    value={org.registrationNumber}
                    onChange={(e) =>
                      setOrg((prev) => ({
                        ...prev,
                        registrationNumber: formatRegistrationNumber(e.target.value),
                      }))
                    }
                  />
                </FormField>
                <FormField label="문의 번호">
                  <TextInput
                    type="tel"
                    name="orgPhone"
                    autoComplete="tel"
                    disabled={!!businessId}
                    value={org.phone}
                    onChange={setOrgField('phone')}
                  />
                </FormField>
                <FormField label="이메일">
                  <TextInput
                    type="email"
                    name="orgEmail"
                    disabled={!!businessId}
                    value={org.email}
                    onChange={setOrgField('email')}
                  />
                </FormField>
              </Form>
            )}
          </StepBody>
        </Content>
        <Actions single={step === 0}>
          {step > 0 && (
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
const CheckRow = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  width: 'fit-content',
  ...textStyle.mBodyDetail,
  color: c.gray700,
});
const CheckLabel = styled.label({
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
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
const ConsentLink = styled(Link)({
  color: 'inherit',
  textDecoration: 'underline',
  textUnderlineOffset: 3,
  '&:hover': { color: c.gray900 },
});
const ExistingAccountLink = styled(Link)({
  color: c.primary,
  textDecoration: 'underline',
  textUnderlineOffset: 3,
});
