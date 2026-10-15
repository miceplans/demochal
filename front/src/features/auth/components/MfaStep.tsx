'use client';

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import styled from '@emotion/styled';
import { toDataURL } from 'qrcode';
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser';
import { generated } from '@semochal/api-client';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { apiErrorMessage } from '@/lib/api-error';
import { useToast } from '@/components/common/Toast';
import type { MfaChallenge, MfaMethodName, MfaUser, PasskeyRegistrationBody } from '../mfa-types';

type VerifyMethod = MfaMethodName;
type EnrollStage = 'choose' | 'totp' | 'recovery';

interface MfaStepProps {
  challenge: MfaChallenge;
  /** 2차 인증(또는 첫 수단 등록)이 끝나 세션 쿠키가 발급된 뒤 호출된다. */
  onAuthenticated: (user: MfaUser) => void;
  /** 비밀번호 단계로 돌아간다. */
  onCancel: () => void;
}

const METHOD_LABEL: Record<VerifyMethod, string> = {
  totp: '인증 앱 코드',
  passkey: '패스키',
  recovery: '복구 코드',
};

/** 로그인 2단계: 검증(수단 선택·코드 입력·패스키) 또는 미등록 계정의 첫 수단 등록. */
export function MfaStep({ challenge, onAuthenticated, onCancel }: MfaStepProps) {
  return challenge.mfaEnrollmentRequired ? (
    <Enrollment challenge={challenge} onAuthenticated={onAuthenticated} onCancel={onCancel} />
  ) : (
    <Verification challenge={challenge} onAuthenticated={onAuthenticated} onCancel={onCancel} />
  );
}

function Verification({ challenge, onAuthenticated, onCancel }: MfaStepProps) {
  const toast = useToast();
  const { mfaToken } = challenge;
  // 복구 코드는 수단 선택 목록에 항상 마지막 대안으로 둔다.
  const methods: VerifyMethod[] = [
    ...challenge.methods.filter((m) => m !== 'recovery'),
    'recovery',
  ];
  const [method, setMethod] = useState<VerifyMethod>(methods[0] ?? 'recovery');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (task: () => Promise<{ status: number; data: unknown }>) => {
    setBusy(true);
    try {
      const res = await task();
      if (res.status !== 200) throw new Error('mfa verify failed');
      onAuthenticated((res.data as { user: MfaUser }).user);
    } catch (error) {
      toast.error(apiErrorMessage(error, '인증에 실패했어요. 다시 시도해 주세요.'));
    } finally {
      setBusy(false);
    }
  };

  const submitCode = (event: FormEvent) => {
    event.preventDefault();
    const value = code.trim();
    if (!value) return;
    void run(() =>
      method === 'recovery'
        ? generated.verifyMfaRecoveryCode({ mfaToken, code: value })
        : generated.verifyMfaTotp({ mfaToken, code: value }),
    );
  };

  const submitPasskey = () =>
    run(async () => {
      const optionsRes = await generated.getMfaPasskeyAuthOptions({ mfaToken });
      if (optionsRes.status !== 200) throw new Error('passkey options failed');
      const credential = await startAuthentication({
        optionsJSON: optionsRes.data.options as unknown as PublicKeyCredentialRequestOptionsJSON,
      });
      return generated.verifyMfaPasskey({
        mfaToken,
        credential: credential as unknown as Parameters<
          typeof generated.verifyMfaPasskey
        >[0]['credential'],
      });
    });

  return (
    <Wrap>
      <Heading>2단계 인증</Heading>
      <Hint>계정 보호를 위해 추가 인증이 필요해요.</Hint>
      {methods.length > 1 && (
        <Tabs role="tablist" aria-label="인증 수단">
          {methods.map((m) => (
            <Tab
              key={m}
              type="button"
              role="tab"
              aria-selected={m === method}
              $active={m === method}
              onClick={() => {
                setMethod(m);
                setCode('');
              }}
            >
              {METHOD_LABEL[m]}
            </Tab>
          ))}
        </Tabs>
      )}
      {method === 'passkey' ? (
        <PrimaryButton type="button" disabled={busy} onClick={() => void submitPasskey()}>
          {busy ? '확인 중...' : '패스키로 인증'}
        </PrimaryButton>
      ) : (
        <form onSubmit={submitCode} noValidate>
          <Field>
            <Label htmlFor="mfa-code">
              {method === 'recovery' ? '복구 코드' : '인증 앱의 6자리 코드'}
            </Label>
            <Input
              id="mfa-code"
              autoComplete="one-time-code"
              inputMode={method === 'recovery' ? 'text' : 'numeric'}
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
          </Field>
          <PrimaryButton type="submit" disabled={busy}>
            {busy ? '확인 중...' : '인증'}
          </PrimaryButton>
        </form>
      )}
      <LinkButton type="button" onClick={onCancel}>
        처음으로 돌아가기
      </LinkButton>
    </Wrap>
  );
}

function Enrollment({ challenge, onAuthenticated, onCancel }: MfaStepProps) {
  const toast = useToast();
  const { mfaToken } = challenge;
  const [stage, setStage] = useState<EnrollStage>('choose');
  const [busy, setBusy] = useState(false);
  const [setup, setSetup] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [code, setCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

  const finish = (codes: string[] | null) => {
    if (codes && codes.length > 0) {
      setRecoveryCodes(codes);
      setStage('recovery');
    } else {
      onAuthenticated(challenge.user);
    }
  };

  const fail = (error: unknown, fallback: string) => toast.error(apiErrorMessage(error, fallback));

  const startTotp = async () => {
    setBusy(true);
    try {
      const res = await generated.setupMfaTotp({ mfaToken });
      if (res.status !== 200) throw new Error('totp setup failed');
      setSetup(res.data);
      setStage('totp');
    } catch (error) {
      fail(error, '인증 앱 등록을 시작하지 못했어요.');
    } finally {
      setBusy(false);
    }
  };

  const confirmTotp = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const res = await generated.confirmMfaTotp({ mfaToken, code: code.trim() });
      if (res.status !== 200) throw new Error('totp confirm failed');
      finish(res.data.recoveryCodes);
    } catch (error) {
      fail(error, '코드가 올바르지 않아요.');
    } finally {
      setBusy(false);
    }
  };

  const registerPasskey = async () => {
    setBusy(true);
    try {
      const optionsRes = await generated.getMfaPasskeyRegisterOptions({ mfaToken });
      if (optionsRes.status !== 200) throw new Error('passkey options failed');
      const credential = await startRegistration({
        optionsJSON: optionsRes.data.options as unknown as PublicKeyCredentialCreationOptionsJSON,
      });
      const res = await generated.verifyMfaPasskeyRegistration({
        mfaToken,
        credential: credential as unknown as PasskeyRegistrationBody,
      });
      if (res.status !== 200) throw new Error('passkey register failed');
      finish(res.data.recoveryCodes);
    } catch (error) {
      fail(error, '패스키를 등록하지 못했어요.');
    } finally {
      setBusy(false);
    }
  };

  if (stage === 'recovery') {
    return (
      <Wrap>
        <RecoveryCodesPanel codes={recoveryCodes} onDone={() => onAuthenticated(challenge.user)} />
      </Wrap>
    );
  }

  if (stage === 'totp' && setup) {
    return (
      <Wrap>
        <Heading>인증 앱 등록</Heading>
        <Hint>
          인증 앱(Google Authenticator 등)에서 QR 코드를 스캔하거나 아래 키를 직접 입력한 뒤,
          표시되는 6자리 코드를 입력해 주세요.
        </Hint>
        <TotpQr otpauthUrl={setup.otpauthUrl} />
        <SecretBox aria-label="TOTP 시크릿">{setup.secret}</SecretBox>
        <form onSubmit={(event) => void confirmTotp(event)} noValidate>
          <Field>
            <Label htmlFor="mfa-totp-code">6자리 코드</Label>
            <Input
              id="mfa-totp-code"
              autoComplete="one-time-code"
              inputMode="numeric"
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
          </Field>
          <PrimaryButton type="submit" disabled={busy}>
            {busy ? '확인 중...' : '등록 완료'}
          </PrimaryButton>
        </form>
        <LinkButton type="button" onClick={() => setStage('choose')}>
          다른 수단 선택
        </LinkButton>
      </Wrap>
    );
  }

  return (
    <Wrap>
      <Heading>2단계 인증 등록</Heading>
      <Hint>
        관리자·기업 계정은 2단계 인증 등록이 필요해요. 사용할 수단을 선택해 주세요. (나중에 다른
        수단도 추가할 수 있어요.)
      </Hint>
      <PrimaryButton type="button" disabled={busy} onClick={() => void startTotp()}>
        인증 앱(TOTP)으로 등록
      </PrimaryButton>
      <SecondaryButton type="button" disabled={busy} onClick={() => void registerPasskey()}>
        패스키로 등록
      </SecondaryButton>
      <LinkButton type="button" onClick={onCancel}>
        처음으로 돌아가기
      </LinkButton>
    </Wrap>
  );
}

/** otpauth URL을 QR 이미지로 렌더링한다. 생성에 실패하면 수동 입력 안낧만 남는다. */
function TotpQr({ otpauthUrl }: { otpauthUrl: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    toDataURL(otpauthUrl, { margin: 1, width: 180 })
      .then((url) => {
        if (alive) setDataUrl(url);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [otpauthUrl]);
  if (!dataUrl) return null;
  return <QrImage src={dataUrl} alt="TOTP 등록 QR 코드" />;
}

/** 복구 코드는 발급 시 한 번만 보여 주므로, 저장했음을 확인해야 다음 단계로 넘어간다. */
export function RecoveryCodesPanel({
  codes,
  onDone,
  doneLabel = '계속하기',
}: {
  codes: string[];
  onDone: () => void;
  doneLabel?: ReactNode;
}) {
  const [saved, setSaved] = useState(false);
  return (
    <>
      <Heading>복구 코드를 저장해 주세요</Heading>
      <Hint>
        인증 수단을 사용할 수 없을 때 각 코드를 한 번씩 쓸 수 있어요. 이 화면을 닫으면 다시 볼 수
        없으니 안전한 곳에 보관해 주세요.
      </Hint>
      <CodeGrid aria-label="복구 코드">
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </CodeGrid>
      <CheckRow>
        <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
        복구 코드를 안전한 곳에 저장했어요
      </CheckRow>
      <PrimaryButton type="button" disabled={!saved} onClick={onDone}>
        {doneLabel}
      </PrimaryButton>
    </>
  );
}

export const Wrap = styled.div({
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  width: '100%',
});
export const Heading = styled.h2({ margin: 0, ...textStyle.h3_2, color: c.gray900 });
export const Hint = styled.p({ margin: 0, ...textStyle.metaText, color: c.gray500 });
export const Field = styled.div({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  marginBottom: 16,
});
export const Label = styled.label({ ...textStyle.mBodyText, color: c.gray900 });
export const Input = styled.input({
  height: 44,
  border: `0.5px solid ${c.gray200}`,
  borderRadius: 8,
  padding: '0 14px',
  ...textStyle.mListText,
  color: c.gray900,
  '&:focus': { outline: 'none' },
});
export const PrimaryButton = styled.button({
  height: 44,
  border: 'none',
  borderRadius: 8,
  background: c.primary,
  color: c.white,
  ...textStyle.buttonLabel,
  cursor: 'pointer',
  '&:disabled': { opacity: 0.5, cursor: 'not-allowed' },
});
export const SecondaryButton = styled(PrimaryButton)({
  background: c.lightBlue,
  color: c.primary,
});
export const LinkButton = styled.button({
  border: 'none',
  background: 'none',
  color: c.gray700,
  textDecoration: 'underline',
  cursor: 'pointer',
  ...textStyle.metaText,
});
const Tabs = styled.div({ display: 'flex', gap: 8 });
const Tab = styled.button<{ $active: boolean }>(({ $active }) => ({
  flex: 1,
  height: 36,
  border: `0.5px solid ${$active ? c.primary : c.gray200}`,
  borderRadius: 8,
  background: $active ? c.lightBlue : c.white,
  color: $active ? c.primary : c.gray700,
  ...textStyle.metaText,
  cursor: 'pointer',
}));
const SecretBox = styled.code({
  padding: '12px 14px',
  borderRadius: 8,
  background: c.gray100,
  color: c.gray900,
  wordBreak: 'break-all',
});
const QrImage = styled.img({
  width: 180,
  height: 180,
  alignSelf: 'center',
});
const CodeGrid = styled.ul({
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 8,
  margin: 0,
  padding: 16,
  listStyle: 'none',
  borderRadius: 8,
  background: c.gray100,
  color: c.gray900,
  fontFamily: 'monospace',
});
const CheckRow = styled.label({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  ...textStyle.metaText,
  color: c.gray700,
});
