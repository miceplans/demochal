'use client';
import { useState, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import styled from '@emotion/styled';
import { ApiError } from '@semochal/api-client';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { StepProgressBar } from '@/components/ui/StepProgressBar';
import { useToast } from '@/components/common/Toast';
import { adApi } from '@/lib/ad-api';
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

const stepLabels = ['약관 동의', '계정 정보', '기관 인증'];

// server/src/modules/files/request-upload.dto.ts의 제한과 동일.
const ALLOWED_DOC_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_DOC_BYTES = 10 * 1024 * 1024;

export function BizLoginFlow() {
  const router = useRouter();
  const hrefOf = useBizHref();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [agreed, setAgreed] = useState<string[]>([]);
  const [account, setAccount] = useState({
    name: '',
    affiliation: '',
    email: '',
    phone: '',
    username: '',
    password: '',
  });
  const [docFile, setDocFile] = useState<File | null>(null);
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const toggle = (v: string) =>
    setAgreed((s) => (s.includes(v) ? s.filter((x) => x !== v) : [...s, v]));
  const setAccountField = (key: keyof typeof account) => (e: ChangeEvent<HTMLInputElement>) =>
    setAccount((s) => ({ ...s, [key]: e.target.value }));
  const pickDoc = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!ALLOWED_DOC_TYPES.includes(file.type)) {
      toast.error('지원하지 않는 파일 형식이에요.', 'JPG, PNG, WEBP, PDF만 첨부할 수 있어요.');
      return;
    }
    if (file.size > MAX_DOC_BYTES) {
      toast.error('파일 크기를 확인해주세요.', '10MB 이하 파일만 첨부할 수 있어요.');
      return;
    }
    setDocFile(file);
  };
  const goNext = () => {
    if (step === 1 && !validateAccount()) return;
    setStep((s) => s + 1);
  };
  const validateAccount = () => {
    const { name, affiliation, email, phone, username, password } = account;
    if (!name.trim() || !affiliation.trim() || !phone.trim() || !username.trim()) {
      toast.error('계정 정보를 입력해주세요.', '모든 항목을 입력해 주세요.');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('이메일을 확인해주세요.');
      return false;
    }
    if (password.length < 8) {
      toast.error('비밀번호를 확인해주세요.', '8자 이상 입력해 주세요.');
      return false;
    }
    return true;
  };
  const completeVerification = async () => {
    const registrationNumberDigits = registrationNumber.replace(/\D/g, '');
    if (!/^\d{10}$/.test(registrationNumberDigits)) {
      toast.error('사업자등록번호를 확인해주세요.', '숫자 10자리를 입력해 주세요.');
      return;
    }
    if (!docFile) {
      toast.error('사업자등록증을 첨부해주세요.');
      return;
    }
    setSubmitting(true);
    try {
      await adApi.auth.register({
        email: account.email,
        password: account.password,
        name: account.name,
      });
      const presigned = await adApi.files.requestUpload({
        bucket: 'private',
        contentType: docFile.type,
        fileName: docFile.name,
        sizeBytes: docFile.size,
      });
      const uploadRes = await fetch(presigned.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': docFile.type },
        body: docFile,
      });
      if (!uploadRes.ok) throw new Error('사업자등록증 업로드에 실패했습니다.');
      await adApi.files.finalizeUpload(presigned.fileId);
      const business = await adApi.businesses.register({
        name: account.affiliation,
        registrationNumber: registrationNumberDigits,
      });
      await adApi.verifications.submit({
        businessId: business.id,
        documentFileId: presigned.fileId,
      });
      toast.success('가입이 완료되었어요.', '사업자 인증이 접수되었어요.');
      router.push(hrefOf('/dashboard'));
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        toast.error('이미 가입된 이메일입니다.', '로그인 화면으로 이동해 주세요.');
      } else {
        toast.error('가입 처리 중 오류가 발생했어요.', '잠시 후 다시 시도해 주세요.');
      }
    } finally {
      setSubmitting(false);
    }
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
                    <FieldInput value={account.name} onChange={setAccountField('name')} />
                  </Field>
                  <Field>
                    소속
                    <FieldInput
                      value={account.affiliation}
                      onChange={setAccountField('affiliation')}
                    />
                  </Field>
                  <Field>
                    이메일
                    <FieldInput
                      type="email"
                      value={account.email}
                      onChange={setAccountField('email')}
                      autoComplete="email"
                    />
                  </Field>
                  <Field>
                    전화번호
                    <FieldInput
                      value={account.phone}
                      onChange={setAccountField('phone')}
                      inputMode="tel"
                      autoComplete="tel"
                    />
                  </Field>
                  <Field>
                    아이디
                    <FieldInput value={account.username} onChange={setAccountField('username')} />
                  </Field>
                  <Field>
                    비밀번호
                    <FieldInput
                      type="password"
                      placeholder="비밀번호를 입력하세요"
                      value={account.password}
                      onChange={setAccountField('password')}
                      autoComplete="new-password"
                    />
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
                    {docFile?.name ?? '사업자등록증 첨부'}
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
                disabled={(step === 0 && agreed.length < 2) || submitting}
                onClick={goNext}
              >
                다음
              </PrimaryButton>
            ) : (
              <PrimaryButton onClick={completeVerification} disabled={submitting}>
                {submitting ? '가입 중...' : '다음'}
              </PrimaryButton>
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
