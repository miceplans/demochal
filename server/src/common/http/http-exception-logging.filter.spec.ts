import { BadRequestException, InternalServerErrorException, Logger } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  HttpExceptionLoggingFilter,
  messageForLog,
  pathForLog,
} from './http-exception-logging.filter.js';

function makeHost(method: string, originalUrl: string): ArgumentsHost {
  const req = { method, originalUrl };
  const res = {};
  return {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
    // BaseExceptionFilter가 응답 객체를 host.getArgByIndex(1)로 꺼낸다.
    getArgByIndex: (index: number) => [req, res][index],
    getArgs: () => [req, res],
  } as unknown as ArgumentsHost;
}

function makeFilter() {
  const reply = vi.fn();
  const adapter = { reply, isHeadersSent: () => false };
  const filter = new HttpExceptionLoggingFilter(adapter as never);
  return { filter, reply };
}

afterEach(() => vi.restoreAllMocks());

describe('HttpExceptionLoggingFilter', () => {
  it('4xx는 warn으로 상태코드·메서드·경로·메시지를 남기고 응답은 그대로 보낸다', () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const { filter, reply } = makeFilter();

    filter.catch(
      new BadRequestException('A ready private file owned by the applicant is required'),
      makeHost('POST', '/applications/1/submit'),
    );

    expect(warn).toHaveBeenCalledWith(
      '400 POST /applications/1/submit - A ready private file owned by the applicant is required',
    );
    expect(reply).toHaveBeenCalledTimes(1);
    expect(reply.mock.calls[0]?.[1]).toMatchObject({ statusCode: 400 });
  });

  it('쿼리스트링(OAuth code 등)은 로그에 남기지 않는다', () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const { filter } = makeFilter();

    filter.catch(
      new BadRequestException('x'),
      makeHost('GET', '/auth/google/callback?code=SECRET'),
    );

    expect(String(warn.mock.calls[0]?.[0])).not.toContain('SECRET');
  });

  it('5xx HttpException은 error로 스택과 함께 남긴다', () => {
    const error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { filter } = makeFilter();

    filter.catch(new InternalServerErrorException('boom'), makeHost('GET', '/x'));

    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('500 GET /x - boom'),
      expect.any(String),
    );
  });
});

describe('helpers', () => {
  it('pathForLog는 쿼리를 제거한다', () => {
    expect(pathForLog('/a/b?token=1')).toBe('/a/b');
    expect(pathForLog(undefined)).toBe('(unknown)');
  });

  it('messageForLog는 검증 오류 배열을 합치고 길이를 제한한다', () => {
    expect(messageForLog(new BadRequestException(['a must be string', 'b required']))).toBe(
      'a must be string; b required',
    );
    expect(messageForLog(new BadRequestException('x'.repeat(400))).length).toBe(301);
  });
});
