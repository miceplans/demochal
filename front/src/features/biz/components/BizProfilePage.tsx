'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { LoadingState } from '@/components/common/LoadingState';
import styled from '@emotion/styled';
import { ApiError, generated } from '@semochal/api-client';
import { adApi } from '@/lib/ad-api';
import { Modal } from '@/components/common/Feedback';
import { useToast } from '@/components/common/Toast';
import { BizOrgProfile } from '@/components/biz/BizOrgProfile';
import { BizContent, PrimaryButton, useBizHref } from '@/components/biz/BizShell';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { apiErrorMessage } from '@/lib/api-error';

async function resolveFileUrl(fileId?: string | null): Promise<string | null> {
  if (!fileId) return null;
  try {
    return (await adApi.files.get(fileId)).url ?? null;
  } catch {
    return null;
  }
}

export function BizProfilePage() {
  const hrefOf = useBizHref();
  const toast = useToast();
  const changePassword = generated.useChangePassword();
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });
  const authQuery = generated.useGetMyAuthInfo({ query: { retry: false } });
  const businessQuery = generated.useFindMyBusiness();
  const business = businessQuery.data?.status === 200 ? businessQuery.data.data : null;
  const [images, setImages] = useState<{ banner: string | null; logo: string | null }>({
    banner: null,
    logo: null,
  });
  useEffect(() => {
    if (!business) return;
    void Promise.all([
      resolveFileUrl(business.bannerImageFileId),
      resolveFileUrl(business.logoImageFileId),
    ]).then(([banner, logo]) => setImages({ banner, logo }));
  }, [business]);
  const user = authQuery.data?.status === 200 ? authQuery.data.data : null;

  const closePasswordDialog = () => {
    if (changePassword.isPending) return;
    setPasswordDialogOpen(false);
    setPasswords({ current: '', next: '', confirm: '' });
  };
  const submitPasswordChange = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (passwords.next !== passwords.confirm) return;
    try {
      const result = await changePassword.mutateAsync({
        data: {
          currentPassword: passwords.current,
          newPassword: passwords.next,
          confirmNewPassword: passwords.confirm,
        },
      });
      if (result.status !== 200) throw new Error('password-change-failed');
      closePasswordDialog();
      toast.success('비밀번호를 변경했습니다.');
    } catch (error) {
      toast.error(
        error instanceof ApiError
          ? apiErrorMessage(error, '현재 비밀번호를 확인하고 다시 시도해 주세요.')
          : '현재 비밀번호를 확인하고 다시 시도해 주세요.',
      );
    }
  };

  if (businessQuery.isError)
    return (
      <BizContent>
        <p role="alert">
          {apiErrorMessage(businessQuery.error, '기업 정보를 불러오지 못했습니다.')}
        </p>
      </BizContent>
    );
  if (!business)
    return (
      <BizContent>
        <LoadingState label="기업 정보를 불러오는 중입니다." />
      </BizContent>
    );
  const rows: [string, string | undefined][] = [
    ['성함', user?.name],
    ['소속', business.name ?? undefined],
    ['이메일', user?.email],
    ['전화번호', business.phone ?? undefined],
    ['아이디', user?.email?.split('@')[0]],
  ];
  return (
    <BizContent style={{ gap: 48 }}>
      <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Heading>나의 정보</Heading>
        <List>
          {rows.map(([label, value]) => (
            <Row key={label}>
              <Label>{label}</Label>
              <span>{value}</span>
            </Row>
          ))}
          <Row>
            <Label>비밀번호</Label>
            <ResetButton type="button" onClick={() => setPasswordDialogOpen(true)}>
              재설정
            </ResetButton>
          </Row>
          <Row style={{ alignItems: 'flex-start' }}>
            <Label>인증 서류</Label>
            <Document aria-hidden />
          </Row>
        </List>
      </section>
      <BizOrgProfile
        bannerUrl={images.banner}
        logoUrl={images.logo}
        name={business.name}
        address={business.address}
        phone={business.phone}
        email={business.email}
        action={
          <PrimaryButton
            style={{ marginTop: 70 }}
            onClick={() => (window.location.href = hrefOf('/profile/edit'))}
          >
            내 기업 프로필 수정하기
          </PrimaryButton>
        }
      />
      <Modal
        open={passwordDialogOpen}
        onClose={closePasswordDialog}
        title="비밀번호 변경"
        width={440}
      >
        <PasswordForm onSubmit={(event) => void submitPasswordChange(event)}>
          <PasswordField>
            <span>현재 비밀번호</span>
            <input
              autoComplete="current-password"
              type="password"
              minLength={8}
              maxLength={128}
              required
              value={passwords.current}
              onChange={(event) =>
                setPasswords((value) => ({ ...value, current: event.target.value }))
              }
            />
          </PasswordField>
          <PasswordField>
            <span>새 비밀번호</span>
            <input
              autoComplete="new-password"
              type="password"
              minLength={8}
              maxLength={128}
              required
              value={passwords.next}
              onChange={(event) =>
                setPasswords((value) => ({ ...value, next: event.target.value }))
              }
            />
          </PasswordField>
          <PasswordField>
            <span>새 비밀번호 확인</span>
            <input
              autoComplete="new-password"
              type="password"
              minLength={8}
              maxLength={128}
              required
              value={passwords.confirm}
              onChange={(event) =>
                setPasswords((value) => ({ ...value, confirm: event.target.value }))
              }
            />
          </PasswordField>
          {passwords.confirm && passwords.next !== passwords.confirm && (
            <PasswordHint role="alert">새 비밀번호가 일치하지 않습니다.</PasswordHint>
          )}
          <PasswordActions>
            <ResetButton
              type="button"
              disabled={changePassword.isPending}
              onClick={closePasswordDialog}
            >
              취소
            </ResetButton>
            <ResetButton
              type="submit"
              disabled={
                changePassword.isPending ||
                passwords.current.length < 8 ||
                passwords.next.length < 8 ||
                passwords.next !== passwords.confirm
              }
            >
              {changePassword.isPending ? '변경 중…' : '변경하기'}
            </ResetButton>
          </PasswordActions>
        </PasswordForm>
      </Modal>
    </BizContent>
  );
}

const Heading = styled.h1({ margin: 0, ...textStyle.h1_2, color: c.gray900 });
const List = styled.div({
  border: `0.5px solid ${c.gray100}`,
  borderRadius: 12,
  overflow: 'hidden',
});
const Row = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: 16,
  minHeight: 56,
  padding: '18px 16px',
  ...textStyle.bodyLarge,
  color: c.gray900,
  '& + &': { borderTop: `0.5px solid ${c.gray100}` },
});
const Label = styled.span({ width: 80, flexShrink: 0 });
const ResetButton = styled.button({
  width: 89,
  height: 37,
  border: 0,
  borderRadius: 6,
  background: c.primary,
  color: c.white,
  ...textStyle.subtitle,
});
const PasswordForm = styled.form({ display: 'flex', flexDirection: 'column', gap: 14 });
const PasswordField = styled.label({
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  ...textStyle.caption,
  color: c.gray700,
  '& input': {
    height: 42,
    padding: '0 12px',
    border: `0.5px solid ${c.gray100}`,
    borderRadius: 6,
    font: 'inherit',
  },
});
const PasswordHint = styled.p({ margin: 0, color: c.red, ...textStyle.caption });
const PasswordActions = styled.div({
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 8,
  '& button:first-of-type': { background: c.gray100, color: c.gray700 },
});
// 사업자등록증 원본은 private 버킷 문서라 화면에는 흐림 처리된 자리표시만 둔다.
const Document = styled.div({
  width: 100,
  height: 144,
  background: c.gray100,
  filter: 'blur(1.2px)',
});
