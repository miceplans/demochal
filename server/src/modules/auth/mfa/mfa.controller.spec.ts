import { describe, expect, it, vi } from 'vitest';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import { MfaController } from './mfa.controller.js';
import { AUTH_COOKIE_NAME, authCookieOptions } from '../auth.cookie.js';
import { SKIP_INPUT_SECURITY_KEY } from '../../../common/security/skip-input-security.decorator.js';
import type { MfaService } from './mfa.service.js';

const admin = { id: 'admin-1', email: 'admin@semochal.kr', name: '관리자', role: 'admin' };

function response() {
  return { cookie: vi.fn() } as unknown as Response;
}

function createController() {
  const service = {
    setupTotp: vi.fn(),
    confirmTotp: vi.fn(),
    getStatus: vi.fn(),
    beginPasskeyRegistration: vi.fn(),
    completePasskeyRegistration: vi.fn(),
    deleteTotp: vi.fn(),
    deletePasskey: vi.fn(),
    regenerateRecoveryCodes: vi.fn(),
    verifyTotpCode: vi.fn(),
    beginPasskeyAuthentication: vi.fn(),
    verifyPasskey: vi.fn(),
    verifyRecoveryCode: vi.fn(),
    issueSession: vi.fn(),
  };
  return {
    controller: new MfaController(service as unknown as MfaService),
    service,
  };
}

describe('MfaController 등록·관리', () => {
  it('totp confirm은 첫 수단 등록 완료 시 세션 쿠키를 발급하고 복구 코드를 반환한다', async () => {
    const { controller, service } = createController();
    service.confirmTotp.mockResolvedValue({ recoveryCodes: ['AAAA-BBBB-CCCC'], firstMethod: true });
    service.issueSession.mockResolvedValue({ accessToken: 'session-token', user: admin });
    const res = response();

    await expect(controller.confirmTotp({ code: '123456' }, admin, res)).resolves.toEqual({
      recoveryCodes: ['AAAA-BBBB-CCCC'],
    });
    expect(res.cookie).toHaveBeenCalledWith(AUTH_COOKIE_NAME, 'session-token', authCookieOptions);
  });

  it('첫 수단이 아니면 쿠키 없이 recoveryCodes: null을 반환한다', async () => {
    const { controller, service } = createController();
    service.confirmTotp.mockResolvedValue({ recoveryCodes: null, firstMethod: false });
    const res = response();

    await expect(controller.confirmTotp({ code: '123456' }, admin, res)).resolves.toEqual({
      recoveryCodes: null,
    });
    expect(res.cookie).not.toHaveBeenCalled();
    expect(service.issueSession).not.toHaveBeenCalled();
  });

  it('passkey register-verify도 첫 수단이면 세션 쿠키를 발급한다', async () => {
    const { controller, service } = createController();
    service.completePasskeyRegistration.mockResolvedValue({
      id: 'pk-1',
      recoveryCodes: ['AAAA-BBBB-CCCC'],
      firstMethod: true,
    });
    service.issueSession.mockResolvedValue({ accessToken: 'session-token', user: admin });
    const res = response();
    const credential = { id: 'cred', response: {} } as never;

    await expect(controller.registerVerify({ credential }, admin, res)).resolves.toEqual({
      id: 'pk-1',
      recoveryCodes: ['AAAA-BBBB-CCCC'],
    });
    expect(service.completePasskeyRegistration).toHaveBeenCalledWith(admin, credential);
    expect(res.cookie).toHaveBeenCalledWith(AUTH_COOKIE_NAME, 'session-token', authCookieOptions);
  });

  it('수단 삭제와 복구 코드 재발급은 서비스에 위임한다', async () => {
    const { controller, service } = createController();
    await expect(
      controller.removeTotp({ password: 'pw' }, admin),
    ).resolves.toBeUndefined();
    expect(service.deleteTotp).toHaveBeenCalledWith(admin.id, 'pw');

    await expect(
      controller.removePasskey('pk-9', { password: 'pw' }, admin),
    ).resolves.toBeUndefined();
    expect(service.deletePasskey).toHaveBeenCalledWith(admin.id, 'pk-9', 'pw');

    service.regenerateRecoveryCodes.mockResolvedValue(['XXXX-XXXX-XXXX']);
    await expect(controller.regenerate({ password: 'pw' }, admin)).resolves.toEqual({
      recoveryCodes: ['XXXX-XXXX-XXXX'],
    });
  });

  it('setup·status·register-options·auth-options는 서비스 결과를 그대로 반환한다', async () => {
    const { controller, service } = createController();
    service.setupTotp.mockResolvedValue({ secret: 's', otpauthUrl: 'otpauth://x' });
    service.getStatus.mockResolvedValue({ totp: { status: 'pending', verifiedAt: null } });
    service.beginPasskeyRegistration.mockResolvedValue({ options: { challenge: 'c' } });
    service.beginPasskeyAuthentication.mockResolvedValue({ options: { challenge: 'a' } });
    service.verifyTotpCode.mockResolvedValue({ accessToken: 't', user: admin });

    await expect(controller.setupTotp(admin)).resolves.toEqual({
      secret: 's',
      otpauthUrl: 'otpauth://x',
    });
    await expect(controller.status(admin)).resolves.toEqual({
      totp: { status: 'pending', verifiedAt: null },
    });
    await expect(controller.registerOptions(admin)).resolves.toEqual({ options: { challenge: 'c' } });
    await expect(controller.authOptions({ mfaToken: 't' }, admin)).resolves.toEqual({
      options: { challenge: 'a' },
    });
  });
});

describe('MfaController 로그인 검증', () => {
  it.each([
    ['verifyTotp', 'verifyTotpCode'],
    ['verifyPasskey', 'verifyPasskey'],
    ['verifyRecovery', 'verifyRecoveryCode'],
  ] as const)('%s는 성공 시 세션 쿠키를 발급하고 공개 프로필을 반환한다', async (handler, serviceMethod) => {
    const { controller, service } = createController();
    service[serviceMethod].mockResolvedValue({ accessToken: 'session-token', user: admin });
    service.verifyPasskey.mockResolvedValue({ accessToken: 'session-token', user: admin });
    service.verifyRecoveryCode.mockResolvedValue({ accessToken: 'session-token', user: admin });
    service.verifyTotpCode.mockResolvedValue({ accessToken: 'session-token', user: admin });
    const res = response();

    const result =
      handler === 'verifyTotp'
        ? await controller.verifyTotp({ mfaToken: 't', code: '123456' }, admin, res)
        : handler === 'verifyPasskey'
          ? await controller.verifyPasskey({ mfaToken: 't', credential: {} as never }, admin, res)
          : await controller.verifyRecovery({ mfaToken: 't', code: 'AAAA-BBBB-CCCC' }, admin, res);

    expect(result).toEqual({ user: admin });
    expect(res.cookie).toHaveBeenCalledWith(AUTH_COOKIE_NAME, 'session-token', authCookieOptions);
  });
});

describe('MfaController 보안 메타데이터', () => {
  const reflector = new Reflector();

  it('WebAuthn credential을 받는 엔드포인트만 입력 보안 검사를 생략한다', () => {
    expect(
      reflector.get(SKIP_INPUT_SECURITY_KEY, MfaController.prototype.registerVerify),
    ).toBe(true);
    expect(reflector.get(SKIP_INPUT_SECURITY_KEY, MfaController.prototype.verifyPasskey)).toBe(
      true,
    );
    for (const handler of [
      MfaController.prototype.setupTotp,
      MfaController.prototype.confirmTotp,
      MfaController.prototype.status,
      MfaController.prototype.registerOptions,
      MfaController.prototype.removeTotp,
      MfaController.prototype.removePasskey,
      MfaController.prototype.regenerate,
      MfaController.prototype.verifyTotp,
      MfaController.prototype.authOptions,
      MfaController.prototype.verifyRecovery,
    ]) {
      expect(reflector.get(SKIP_INPUT_SECURITY_KEY, handler)).toBeUndefined();
    }
  });
});
