'use client';
import { useState, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import styled from '@emotion/styled';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { StepProgressBar } from '@/components/ui/StepProgressBar';
import { useToast } from '@/components/common/Toast';
import {
  BizGlobalStyles,
  BizLink,
  Logo,
  PrimaryButton,
  OutlineButton,
  Field,
  FieldInput,
  BizFooter,
  useBizHref,
} from '@/components/biz/BizShell';
import { admin } from '@/data/biz-design';

const stepLabels = ['약관 동의', '계정 정보', '기관 인증'];

export function BizLoginFlow() {
  const router = useRouter();
  const hrefOf = useBizHref();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [agreed, setAgreed] = useState<string[]>([]);
  const [docFileName, setDocFileName] = useState<string | null>(null);
  const [registrationNumber, setRegistrationNumber] = useState('');
  const toggle = (v: string) =>
    setAgreed((s) => (s.includes(v) ? s.filter((x) => x !== v) : [...s, v]));
  const pickDoc = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDocFileName(file.name);
  };
  const completeVerification = () => {
    if (!/^\d{10}$/.test(registrationNumber.replace(/\D/g, ''))) {
      toast.error('사업자등록번호를 확인해주세요.', '숫자 10자리를 입력해 주세요.');
      return;
    }
    if (!docFileName) {
      toast.error('사업자등록증을 첨부해주세요.');
      return;
    }
    toast.success('사업자 인증에 성공했어요.');
    router.push(hrefOf('/dashboard'));
  };
  return (
    <Wrap>
      {BizGlobalStyles}
      <Body>
        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            <Logo size={36} />
            <StepProgressBar steps={stepLabels} currentStep={step} />
            {step === 0 && (
              <section aria-label="약관 동의">
                <Title>약관 동의</Title>
                <Form>
                  <CheckRow>
                    <CheckBox
                      type="checkbox"
                      checked={agreed.includes('privacy')}
                      onChange={() => toggle('privacy')}
                    />
                    (필수) 개인정보처리방침 동의
                  </CheckRow>
                  <CheckRow>
                    <CheckBox
                      type="checkbox"
                      checked={agreed.includes('business')}
                      onChange={() => toggle('business')}
                    />
                    (필수) 사업자 이용정보 동의
                  </CheckRow>
                </Form>
              </section>
            )}
            {step === 1 && (
              <section aria-label="계정 정보">
                <Title>계정 정보</Title>
                <Form>
                  <Field>
                    성함
                    <FieldInput defaultValue={admin.name} />
                  </Field>
                  <Field>
                    소속
                    <FieldInput defaultValue={admin.company} />
                  </Field>
                  <Field>
                    이메일
                    <FieldInput
                      type="email"
                      defaultValue={admin.email}
                      placeholder="example@miceplans.com"
                    />
                  </Field>
                  <Field>
                    전화번호
                    <FieldInput defaultValue={admin.phone} />
                  </Field>
                  <Field>
                    아이디
                    <FieldInput defaultValue={admin.id} />
                  </Field>
                  <Field>
                    비밀번호
                    <FieldInput type="password" placeholder="비밀번호를 입력하세요" />
                  </Field>
                </Form>
              </section>
            )}
            {step === 2 && (
              <section aria-label="기관 인증">
                <Title>기관 인증</Title>
                <Form>
                  <UploadBox aria-label="사업자등록증 첨부">
                    <UploadMark src="/assets/icons/fileuploader.png" alt="" aria-hidden />
                    {docFileName ?? '사업자등록증 첨부'}
                    <HiddenInput type="file" accept="image/*,.pdf" onChange={pickDoc} />
                    <OutlineButton type="button" tabIndex={-1}>
                      파일 찾기
                    </OutlineButton>
                  </UploadBox>
                  <Field>
                    사업자등록번호
                    <FieldInput
                      value={registrationNumber}
                      onChange={(event) => setRegistrationNumber(event.target.value)}
                      placeholder="617-81-98126"
                      inputMode="numeric"
                    />
                  </Field>
                </Form>
              </section>
            )}
          </div>
          <Actions>
            {step > 0 && (
              <OutlineButton type="button" onClick={() => setStep((s) => s - 1)}>
                이전
              </OutlineButton>
            )}
            {step < 2 ? (
              <PrimaryButton
                disabled={step === 0 && agreed.length < 2}
                onClick={() => setStep((s) => s + 1)}
              >
                다음
              </PrimaryButton>
            ) : (
              <PrimaryButton onClick={completeVerification}>다음</PrimaryButton>
            )}
          </Actions>
        </Card>
      </Body>
      <p style={{ textAlign: 'center', padding: '0 0 40px', fontSize: 13, color: c.gray700 }}>
        이미 계정이 있으신가요?{' '}
        <BizLink href="/login" style={{ color: c.primary, fontWeight: 600 }}>
          로그인
        </BizLink>
      </p>
      <BizFooter logoSize={36} />
    </Wrap>
  );
}
const Wrap = styled.div({ display: 'flex', flexDirection: 'column' });
const Body = styled.div({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '80px 120px',
});
const Card = styled.div({
  width: 426,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  minHeight: 480,
});
const Title = styled.h1({ ...textStyle.h1_2, marginBottom: 24 });
const Form = styled.div({ display: 'flex', flexDirection: 'column', gap: 16 });
const CheckRow = styled.label({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  ...textStyle.caption,
  color: c.gray700,
  cursor: 'pointer',
});
const CheckBox = styled.input({
  accentColor: c.primary,
  width: 16,
  height: 16,
  borderRadius: 3,
  border: `0.5px solid ${c.gray100}`,
});
const Actions = styled.div({ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 32 });
const UploadBox = styled.label({
  border: `2px dashed ${c.lightBlue}`,
  background: '#f8f8f8',
  borderRadius: 20,
  padding: 8,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
  minHeight: 180,
  ...textStyle.metaText,
  color: c.gray500,
  cursor: 'pointer',
});
const HiddenInput = styled.input({
  position: 'absolute',
  width: 1,
  height: 1,
  opacity: 0,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
});
const UploadMark = styled.img({ width: 57, height: 36 });
