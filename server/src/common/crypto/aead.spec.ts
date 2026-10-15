import { describe, expect, it } from 'vitest';
import { decryptString, encryptString } from './aead.js';

describe('aead encryptString/decryptString', () => {
  it('round-trips a plaintext without storing it verbatim', () => {
    const plaintext = 'JBSWY3DPEHPK3PXP-secret-value';
    const ciphertext = encryptString(plaintext);

    expect(ciphertext).not.toContain(plaintext);
    expect(ciphertext.startsWith('v1:')).toBe(true);
    expect(decryptString(ciphertext)).toBe(plaintext);
  });

  it('produces a different ciphertext on every call (random IV)', () => {
    const plaintext = 'same-input';
    expect(encryptString(plaintext)).not.toBe(encryptString(plaintext));
  });

  it('round-trips unicode text', () => {
    const plaintext = '세모찰-TOTP-시크릿-🐭';
    expect(decryptString(encryptString(plaintext))).toBe(plaintext);
  });

  it('rejects malformed ciphertext', () => {
    expect(() => decryptString('not-a-ciphertext')).toThrow('Invalid ciphertext format');
    expect(() => decryptString('v2:AAAA:BBBB:CCCC')).toThrow('Invalid ciphertext format');
  });

  it('rejects tampered ciphertext (GCM auth tag)', () => {
    const ciphertext = encryptString('secret');
    const [version, iv, tag, data] = ciphertext.split(':');
    const tamperedData = Buffer.from(data!, 'base64');
    tamperedData[0] = tamperedData[0]! ^ 0xff;
    expect(() => decryptString([version, iv, tag, tamperedData.toString('base64')].join(':'))).toThrow();
  });
});
