import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password.js';
import { signSessionToken, verifySessionToken } from './jwt.js';

describe('password hashing', () => {
  it('round-trips a correct password', async () => {
    const stored = await hashPassword('super-secret-password');
    expect(stored.startsWith('scrypt$')).toBe(true);
    await expect(verifyPassword('super-secret-password', stored)).resolves.toBe(true);
  });

  it('rejects a wrong password and null hashes', async () => {
    const stored = await hashPassword('super-secret-password');
    await expect(verifyPassword('wrong-password', stored)).resolves.toBe(false);
    await expect(verifyPassword('super-secret-password', null)).resolves.toBe(false);
    await expect(verifyPassword('x', 'not-a-scrypt-hash')).resolves.toBe(false);
  });
});

describe('session tokens', () => {
  it('round-trips a signed token', () => {
    const token = signSessionToken('user-1', 'user');
    const payload = verifySessionToken(token);
    expect(payload?.sub).toBe('user-1');
    expect(payload?.role).toBe('user');
  });

  it('rejects tampered tokens and wrong segments', () => {
    const token = signSessionToken('user-1', 'user');
    const [header, payload, signature] = token.split('.');
    const tampered = `${header}.${payload}.${signature!.split('').reverse().join('')}`;
    expect(verifySessionToken(tampered)).toBeNull();
    expect(verifySessionToken('a.b')).toBeNull();
    expect(verifySessionToken('not-a-jwt')).toBeNull();
  });

  it('rejects expired tokens', () => {
    const token = signSessionToken('user-1', 'user', -10);
    expect(verifySessionToken(token)).toBeNull();
  });
});
