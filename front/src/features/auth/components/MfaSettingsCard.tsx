'use client';

import { useState, type FormEvent } from 'react';
import styled from '@emotion/styled';
import { useQueryClient } from '@tanstack/react-query';
import { startRegistration } from '@simplewebauthn/browser';
import type { PublicKeyCredentialCreationOptionsJSON } from '@simplewebauthn/browser';
import { generated } from '@semochal/api-client';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { apiErrorMessage } from '@/lib/api-error';
import { useToast } from '@/components/common/Toast';
import type { PasskeyRegistrationBody } from '../mfa-types';
import {
  Field,
  Hint,
  Input,
  Label,
  LinkButton,
  PrimaryButton,
  RecoveryCodesPanel,
  SecondaryButton,
} from './MfaStep';

type PendingAction =
  | { kind: 'delete-totp' }
  | { kind: 'delete-passkey'; id: string }
  | { kind: 'regenerate' }
  | { kind: 'add-totp' }
  | { kind: 'add-passkey' };

/** 로그인한 관리자·사업자가 2FA 수단을 확인·추가·삭제하고 복구 코드를 재발급하는 설정 카드. */
export function MfaSettingsCard() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const statusQuery = generated.useGetMfaStatus();
  const status = statusQuery.data?.status === 200 ? statusQuery.data.data : null;
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: generated.getGetMfaStatusQueryKey() }),
      // 관리자 설정 화면의 '2단계 인증 사용중' 표시를 갱신한다.
      queryClient.invalidateQueries({ queryKey: generated.getGetAdminSettingsQueryKey() }),
    ]);

  const [busy, setBusy] = useState(false);
  const [setup, setSetup] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [code, setCode] = useState('');
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [password, setPassword] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);

  const guarded = async (task: () => Promise<void>, fallback: string) => {
    setBusy(true);
    try {
      await task();
    } catch (error) {
      toast.error(apiErrorMessage(error, fallback));
    } finally {
      setBusy(false);
    }
  };

  const startTotp = (passwordValue: string) =>
    guarded(async () => {
      const res = await generated.setupMfaTotp({ password: passwordValue });
      if (res.status !== 200) throw new Error('totp setup failed');
      setSetup(res.data);
    }, '인증 앱 등록을 시작하지 못했어요.');

  const confirmTotp = (event: FormEvent) => {
    event.preventDefault();
    void guarded(async () => {
      const res = await generated.confirmMfaTotp({ code: code.trim() });
      if (res.status !== 200) throw new Error('totp confirm failed');
      setSetup(null);
      setCode('');
      setRecoveryCodes(res.data.recoveryCodes);
      toast.success('인증 앱을 등록했어요');
      await refresh();
    }, '코드가 올바르지 않아요.');
  };

  const addPasskey = (passwordValue: string) =>
    guarded(async () => {
      const optionsRes = await generated.getMfaPasskeyRegisterOptions({ password: passwordValue });
      if (optionsRes.status !== 200) throw new Error('passkey options failed');
      const credential = await startRegistration({
        optionsJSON: optionsRes.data.options as unknown as PublicKeyCredentialCreationOptionsJSON,
      });
      const res = await generated.verifyMfaPasskeyRegistration({
        credential: credential as unknown as PasskeyRegistrationBody,
      });
      if (res.status !== 200) throw new Error('passkey register failed');
      setRecoveryCodes(res.data.recoveryCodes);
      toast.success('패스키를 등록했어요');
      await refresh();
    }, '패스키를 등록하지 못했어요.');

  const confirmPending = (event: FormEvent) => {
    event.preventDefault();
    if (!pending || !password) return;
    const action = pending;
    // 수단 추가는 등록 절차(코드 입력·패스키 생성)가 이어지므로 비밀번호 확인 폼만 닫고 시작한다.
    if (action.kind === 'add-totp' || action.kind === 'add-passkey') {
      const confirmed = password;
      setPending(null);
      setPassword('');
      void (action.kind === 'add-totp' ? startTotp(confirmed) : addPasskey(confirmed));
      return;
    }
    void guarded(async () => {
      if (action.kind === 'delete-totp') {
        await generated.deleteMfaTotp({ password });
        toast.success('인증 앱을 삭제했어요');
      } else if (action.kind === 'delete-passkey') {
        await generated.deleteMfaPasskey(action.id, { password });
        toast.success('패스키를 삭제했어요');
      } else {
        const res = await generated.regenerateMfaRecoveryCodes({ password });
        if (res.status !== 200) throw new Error('regenerate failed');
        setRecoveryCodes(res.data.recoveryCodes);
      }
      setPending(null);
      setPassword('');
      await refresh();
    }, '비밀번호를 확인해 주세요.');
  };

  if (recoveryCodes && recoveryCodes.length > 0) {
    return (
      <Card aria-label="복구 코드">
        <RecoveryCodesPanel
          codes={recoveryCodes}
          onDone={() => setRecoveryCodes(null)}
          doneLabel="닫기"
        />
      </Card>
    );
  }

  const totpVerified = status?.totp.status === 'verified';

  return (
    <Card aria-label="2단계 인증 관리">
      <Title>2단계 인증 수단</Title>
      <Row>
        <span>인증 앱(TOTP): {totpVerified ? '등록됨' : '미등록'}</span>
        {totpVerified ? (
          <LinkButton type="button" onClick={() => setPending({ kind: 'delete-totp' })}>
            삭제
          </LinkButton>
        ) : (
          <SecondaryButton
            type="button"
            disabled={busy}
            onClick={() => setPending({ kind: 'add-totp' })}
          >
            등록
          </SecondaryButton>
        )}
      </Row>
      {setup && (
        <form onSubmit={confirmTotp} noValidate>
          <Hint>인증 앱에 아래 키를 입력하고 표시되는 6자리 코드를 입력해 주세요.</Hint>
          <Secret aria-label="TOTP 시크릿">{setup.secret}</Secret>
          <a href={setup.otpauthUrl}>인증 앱에서 열기</a>
          <Field>
            <Label htmlFor="mfa-settings-code">6자리 코드</Label>
            <Input
              id="mfa-settings-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
          </Field>
          <PrimaryButton type="submit" disabled={busy}>
            등록 완료
          </PrimaryButton>
        </form>
      )}
      {(status?.passkeys ?? []).map((passkey, index) => (
        <Row key={passkey.id}>
          <span>패스키 {index + 1}</span>
          <LinkButton
            type="button"
            onClick={() => setPending({ kind: 'delete-passkey', id: passkey.id })}
          >
            삭제
          </LinkButton>
        </Row>
      ))}
      <Row>
        <span>패스키 추가</span>
        <SecondaryButton
          type="button"
          disabled={busy}
          onClick={() => setPending({ kind: 'add-passkey' })}
        >
          추가
        </SecondaryButton>
      </Row>
      <Row>
        <span>남은 복구 코드: {status?.recoveryCodesRemaining ?? 0}개</span>
        <SecondaryButton type="button" onClick={() => setPending({ kind: 'regenerate' })}>
          재발급
        </SecondaryButton>
      </Row>
      {pending && (
        <form onSubmit={confirmPending} noValidate>
          <Field>
            <Label htmlFor="mfa-settings-password">비밀번호 확인</Label>
            <Input
              id="mfa-settings-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </Field>
          <PrimaryButton type="submit" disabled={busy || !password}>
            확인
          </PrimaryButton>{' '}
          <LinkButton
            type="button"
            onClick={() => {
              setPending(null);
              setPassword('');
            }}
          >
            취소
          </LinkButton>
        </form>
      )}
    </Card>
  );
}

const Card = styled.section({
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  padding: 20,
  border: `0.5px solid ${c.gray200}`,
  borderRadius: 16,
  background: c.white,
});
const Title = styled.h2({ margin: 0, ...textStyle.h3_2, color: c.gray900 });
const Row = styled.div({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
  ...textStyle.body,
  color: c.gray900,
});
const Secret = styled.code({
  display: 'block',
  padding: '12px 14px',
  borderRadius: 8,
  background: c.gray100,
  color: c.gray900,
  wordBreak: 'break-all',
});
