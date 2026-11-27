import { createHmac } from 'node:crypto';
import { Controller, Get, Req, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Request } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { signedClientIpMiddleware, verifiedClientIp } from './signed-client-ip.js';

const secret = 's'.repeat(32);
const now = 1_795_745_000_000;

function signedHeaders(ip: string, timestamp = String(now)) {
  return {
    'x-semochal-client-ip': ip,
    'x-semochal-client-ip-time': timestamp,
    'x-semochal-client-ip-signature': createHmac('sha256', secret)
      .update(`${timestamp}.${ip}`)
      .digest('hex'),
  };
}

describe('verifiedClientIp', () => {
  it('accepts a fresh signed IPv4 or IPv6 address', () => {
    expect(verifiedClientIp(signedHeaders('198.51.100.7'), secret, now)).toBe('198.51.100.7');
    expect(verifiedClientIp(signedHeaders('2001:db8::7'), secret, now)).toBe('2001:db8::7');
  });

  it('rejects forged, malformed, stale and future headers', () => {
    expect(verifiedClientIp(signedHeaders('198.51.100.7'), undefined, now)).toBeUndefined();
    expect(
      verifiedClientIp(
        { ...signedHeaders('198.51.100.7'), 'x-semochal-client-ip': '1.1.1.1' },
        secret,
        now,
      ),
    ).toBeUndefined();
    expect(verifiedClientIp(signedHeaders('1.1.1.1, 2.2.2.2'), secret, now)).toBeUndefined();
    expect(
      verifiedClientIp(signedHeaders('198.51.100.7', String(now - 30_001)), secret, now),
    ).toBeUndefined();
    expect(
      verifiedClientIp(signedHeaders('198.51.100.7', String(now + 30_001)), secret, now),
    ).toBeUndefined();
    expect(
      verifiedClientIp(
        { ...signedHeaders('198.51.100.7'), 'x-semochal-client-ip-signature': ['a', 'b'] },
        secret,
        now,
      ),
    ).toBeUndefined();
  });
});

describe('signedClientIpMiddleware (Express request)', () => {
  @Controller()
  class IpProbeController {
    @Get('ip')
    ip(@Req() req: Request) {
      return { ip: req.ip };
    }
  }

  async function app(): Promise<INestApplication> {
    const moduleRef = await Test.createTestingModule({
      controllers: [IpProbeController],
    }).compile();
    const instance = moduleRef.createNestApplication();
    instance.getHttpAdapter().getInstance().set('trust proxy', 1);
    instance.use(signedClientIpMiddleware(secret));
    await instance.init();
    return instance;
  }

  it('uses a valid signed client IP', async () => {
    const instance = await app();
    const response = await request(instance.getHttpServer())
      .get('/ip')
      .set({
        ...signedHeaders('198.51.100.7', String(Date.now())),
        'x-forwarded-for': '203.0.113.9',
      });
    await instance.close();
    expect(response.status).toBe(200);
    expect(response.body.ip).toBe('198.51.100.7');
  });

  it('keeps one-hop Express IP when direct callers spoof headers', async () => {
    const instance = await app();
    const response = await request(instance.getHttpServer())
      .get('/ip')
      .set({
        ...signedHeaders('198.51.100.7', String(Date.now())),
        'x-forwarded-for': '192.0.2.1, 203.0.113.9',
        'x-semochal-client-ip-signature': '0'.repeat(64),
      });
    await instance.close();
    expect(response.status).toBe(200);
    expect(response.body.ip).toBe('203.0.113.9');
  });
});
