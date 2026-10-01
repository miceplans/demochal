import { describe, expect, it } from 'vitest';

import { getApiErrorMessage } from './api-error';
import { ApiError } from './http';

describe('getApiErrorMessage', () => {
  it('body.message 문자열을 그대로 반환한다', () => {
    const error = new ApiError(400, {
      statusCode: 400,
      message: '이메일 또는 비밀번호가 올바르지 않습니다.',
    });
    expect(getApiErrorMessage(error)).toBe('이메일 또는 비밀번호가 올바르지 않습니다.');
  });

  it('body.message 배열(ValidationPipe)이면 첫 번째 유효 항목을 반환한다', () => {
    const error = new ApiError(400, {
      message: ['email must be an email', 'password is required'],
    });
    expect(getApiErrorMessage(error)).toBe('email must be an email');
  });

  it('빈 문자열/빈 배열/공백 항목은 서버 메시지로 보지 않는다', () => {
    expect(getApiErrorMessage(new ApiError(400, { message: '' }))).toBeUndefined();
    expect(getApiErrorMessage(new ApiError(400, { message: [] }))).toBeUndefined();
    expect(getApiErrorMessage(new ApiError(400, { message: ['  '] }))).toBeUndefined();
  });

  it('body가 없거나 객체가 아니면 undefined를 반환한다', () => {
    expect(getApiErrorMessage(new ApiError(500, undefined))).toBeUndefined();
    expect(getApiErrorMessage(new ApiError(502, 'Bad Gateway'))).toBeUndefined();
    expect(getApiErrorMessage(new ApiError(400, { statusCode: 400 }))).toBeUndefined();
  });

  it('ApiError가 아니면 undefined를 반환한다', () => {
    expect(getApiErrorMessage(new Error('Failed to fetch'))).toBeUndefined();
    expect(getApiErrorMessage(new TypeError('NetworkError'))).toBeUndefined();
    expect(getApiErrorMessage('error')).toBeUndefined();
    expect(getApiErrorMessage(undefined)).toBeUndefined();
  });
});
