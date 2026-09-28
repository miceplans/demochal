import { Reflector } from '@nestjs/core';
import {
  BadRequestException,
  type ArgumentMetadata,
  type CallHandler,
  type ExecutionContext,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { inputSecurityContext } from './input-security.context.js';
import { InputSecurityPipe } from './input-security.pipe.js';
import { SkipInputSecurity } from './skip-input-security.decorator.js';
import { SkipInputSecurityInterceptor } from './skip-input-security.interceptor.js';

const pipe = new InputSecurityPipe();

function queryMetadata(data: string): ArgumentMetadata {
  return { type: 'query', metatype: String, data };
}

class Probe {
  @SkipInputSecurity()
  optedOut() {}

  standard() {}
}

function executionContextFor(method: keyof Probe): ExecutionContext {
  return {
    getHandler: () => Probe.prototype[method],
    getClass: () => Probe,
  } as unknown as ExecutionContext;
}

describe('InputSecurityPipe', () => {
  it('rejects script payloads by default', () => {
    expect(() => pipe.transform('<script>alert(1)</script>', queryMetadata('q'))).toThrow(
      BadRequestException,
    );
    expect(() => pipe.transform('<img src=x onerror=alert(1)>', queryMetadata('q'))).toThrow(
      BadRequestException,
    );
  });

  it('rejects SQL payloads by default, including the `--` sequence opaque tokens use', () => {
    expect(() => pipe.transform("' OR '1'='1'", queryMetadata('q'))).toThrow(BadRequestException);
    expect(() => pipe.transform('1; DROP TABLE users--', queryMetadata('q'))).toThrow(
      BadRequestException,
    );
    expect(() => pipe.transform('opaque--token--value', queryMetadata('code'))).toThrow(
      BadRequestException,
    );
  });

  it('allows ordinary text through nested query/body objects', () => {
    const query = { keyword: '성동구 카페', tags: ['커피', '디저트'], page: '2' };
    expect(pipe.transform(query, queryMetadata('query'))).toBe(query);
  });

  it('rejects unsafe values nested inside objects and arrays', () => {
    expect(() => pipe.transform({ keyword: "a' OR '1'='1'" }, queryMetadata('query'))).toThrow(
      BadRequestException,
    );
    expect(() => pipe.transform(['ok', 'x--y'], queryMetadata('tags'))).toThrow(
      BadRequestException,
    );
  });

  it('passes values through when the handler-level opt-out is active', () => {
    inputSecurityContext.run({ skipInputSecurity: true }, () => {
      const code = '4/0AeaYUB--opaque--google-authorization--code';
      expect(pipe.transform(code, queryMetadata('code'))).toBe(code);
      const state = 'c2FtcGxl--bm9uY2U.c2lnbmF0dXJl--';
      expect(pipe.transform(state, queryMetadata('state'))).toBe(state);
    });
  });
});

describe('SkipInputSecurityInterceptor', () => {
  const interceptor = new SkipInputSecurityInterceptor(new Reflector());

  function callHandlerObserving(store: { skip?: boolean }) {
    const handler: CallHandler = {
      handle: () =>
        new Observable((subscriber) => {
          store.skip = inputSecurityContext.getStore()?.skipInputSecurity;
          subscriber.complete();
        }),
    };
    return handler;
  }

  it('runs handler execution inside the opt-out context for annotated handlers', () => {
    const store: { skip?: boolean } = {};
    interceptor.intercept(executionContextFor('optedOut'), callHandlerObserving(store)).subscribe();
    expect(store.skip).toBe(true);
  });

  it('leaves the opt-out context unset for handlers without the annotation', () => {
    const store: { skip?: boolean } = {};
    interceptor.intercept(executionContextFor('standard'), callHandlerObserving(store)).subscribe();
    expect(store.skip).toBeUndefined();
    // Outside an opt-out the pipe still blocks the deny-list sequences.
    expect(() => pipe.transform('opaque--token--value', queryMetadata('code'))).toThrow(
      BadRequestException,
    );
  });
});
