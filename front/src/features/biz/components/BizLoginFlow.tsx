'use client';
import { Fragment, useState } from 'react';
import { useRouter } from 'next/navigation';
import styled from '@emotion/styled';
import { colors as c } from '@/styles/design';
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

const Wrap = styled.div({ minHeight: '100dvh', display: 'flex', flexDirection: 'column' });
const Body = styled.div({
  flex: 1,
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
const Steps = styled.ol({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '0 11px',
  listStyle: 'none',
});
const Bar = styled.li({ flex: 1, height: 1.5, background: c.gray200 });
const Step = styled.li({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 7,
  fontSize: 10,
  color: c.gray700,
});
const Dot = styled.span<{ state: 'done' | 'current' | 'todo' }>(({ state }) => ({
  width: 32,
  height: 32,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 10,
  background: state === 'todo' ? c.gray50 : c.white,
  border: `1.5px solid ${state === 'todo' ? c.gray200 : c.primary}`,
  color: state === 'current' ? c.primary : c.gray700,
}));
const Title = styled.h1({ fontSize: 20, fontWeight: 600, marginBottom: 24 });
const Form = styled.div({ display: 'flex', flexDirection: 'column', gap: 16 });
const CheckRow = styled.label({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 13,
  color: c.gray700,
  cursor: 'pointer',
});
const CheckBox = styled.input({ accentColor: c.primary, width: 16, height: 16 });
const Actions = styled.div({ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 32 });
const UploadBox = styled.div({
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
  fontSize: 12,
  color: c.gray500,
});
const UploadMark = styled.span({
  width: 57,
  height: 36,
  background: `radial-gradient(circle at 50% 120%, ${c.primary} 38%, #191f28 100%)`,
  clipPath: 'polygon(50% 0, 100% 100%, 0 100%)',
});
const stepMeta: [string, string][] = [
  ['1', '약관 동의'],
  ['2', '계정 정보'],
  ['3', '기관 인증'],
];

export function BizLoginFlow() {
  const router = useRouter();
  const hrefOf = useBizHref();
  const [step, setStep] = useState(0);
  const [agreed, setAgreed] = useState<string[]>([]);
  const toggle = (v: string) =>
    setAgreed((s) => (s.includes(v) ? s.filter((x) => x !== v) : [...s, v]));
  return (
    <Wrap>
      {BizGlobalStyles}
      <Body>
        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            <Logo size={24} />
            <Steps>
              {stepMeta.map(([index, label], i) => (
                <Fragment key={index}>
                  {i > 0 && <Bar aria-hidden />}
                  <Step>
                    <Dot state={i < step ? 'done' : i === step ? 'current' : 'todo'}>
                      {i < step ? '✓' : index}
                    </Dot>
                    <span>{label}</span>
                  </Step>
                </Fragment>
              ))}
            </Steps>
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
                  <UploadBox>
                    <UploadMark aria-hidden />
                    사업자등록증 첨부
                    <OutlineButton type="button">파일 찾기</OutlineButton>
                  </UploadBox>
                  <Field>
                    사업자등록번호
                    <FieldInput placeholder="617-81-98126" />
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
              <PrimaryButton onClick={() => router.push(hrefOf('/dashboard'))}>다음</PrimaryButton>
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
      <BizFooter />
    </Wrap>
  );
}
