import type { generated } from '@semochal/api-client';

/** orval 모델 타입은 generated 네임스페이스로 재수출되지 않아 응답 타입에서 파생한다. */
type LoginData = Extract<Awaited<ReturnType<typeof generated.login>>, { status: 200 }>['data'];

export type MfaChallenge = Extract<LoginData, { mfaToken: string }>;
export type MfaUser = LoginData['user'];
export type MfaMethodName = MfaChallenge['methods'][number];
export type PasskeyRegistrationBody = NonNullable<
  Parameters<typeof generated.verifyMfaPasskeyRegistration>[0]
>['credential'];
