import { Controller, Get, Query, type INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { InputSecurityPipe } from './input-security.pipe.js';
import { SkipInputSecurity } from './skip-input-security.decorator.js';
import { SkipInputSecurityInterceptor } from './skip-input-security.interceptor.js';

@Controller('probe')
class ProbeController {
  @SkipInputSecurity()
  @Get('opted-out')
  optedOut(@Query('code') code: string) {
    return { code };
  }

  @Get('standard')
  standard(@Query('code') code: string) {
    return { code };
  }
}

// Verifies the interceptor → AsyncLocalStorage → global pipe wiring inside a real
// Nest request pipeline, which the unit tests cannot prove on their own.
describe('SkipInputSecurity (Nest request pipeline)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ controllers: [ProbeController] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new InputSecurityPipe());
    app.useGlobalInterceptors(new SkipInputSecurityInterceptor(new Reflector()));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('accepts an opaque `--` token on an opted-out handler', async () => {
    const code = '4/0AeaYUB--opaque--code';
    const res = await request(app.getHttpServer()).get('/probe/opted-out').query({ code });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ code });
  });

  it('still rejects the same token on a handler without the opt-out', async () => {
    const res = await request(app.getHttpServer())
      .get('/probe/standard')
      .query({ code: '4/0AeaYUB--opaque--code' });
    expect(res.status).toBe(400);
  });

  it('does not leak the opt-out into a following standard request', async () => {
    await request(app.getHttpServer()).get('/probe/opted-out').query({ code: 'a--b' });
    const res = await request(app.getHttpServer())
      .get('/probe/standard')
      .query({ code: '<script>alert(1)</script>' });
    expect(res.status).toBe(400);
  });
});
