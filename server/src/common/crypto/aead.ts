import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';
import { env } from '../../config/env.js';

// TOTP 시크릿 저장용 AEAD 키. 세션 서명 키와 분리하기 위해 JWT 비밀에서 HKDF로 파생한다
// (oauthStateSecret과 같은 패턴, env.ts 참조).
const TOTP_AEAD_KEY = Buffer.from(hkdfSync('sha256', env.jwtSecret, '', 'semochal/mfa-totp', 32));

const CIPHER = 'aes-256-gcm';
const IV_LENGTH_BYTES = 12;
const VERSION_PREFIX = 'v1';

/**
 * 평문을 AES-256-GCM으로 암호화해 `v1:<iv>:<tag>:<data>` 형태의 문자열로 반환한다.
 * 구성 요소는 모두 base64이고 평문은 절대 저장·로깅되지 않는다.
 */
export function encryptString(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(CIPHER, TOTP_AEAD_KEY, iv);
  const data = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    VERSION_PREFIX,
    iv.toString('base64'),
    tag.toString('base64'),
    data.toString('base64'),
  ].join(':');
}

/** encryptString의 역함수. 포맷이 올바르지 않거나 인증에 실패하면 throw한다. */
export function decryptString(ciphertext: string): string {
  const [version, iv, tag, data] = ciphertext.split(':');
  if (version !== VERSION_PREFIX || !iv || !tag || !data) {
    throw new Error('Invalid ciphertext format');
  }
  const decipher = createDecipheriv(CIPHER, TOTP_AEAD_KEY, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString(
    'utf8',
  );
}
