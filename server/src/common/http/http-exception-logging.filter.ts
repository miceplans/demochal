import { ArgumentsHost, Catch, HttpException, Logger } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';

interface RequestLike {
  method?: string;
  originalUrl?: string;
  url?: string;
}

const MAX_MESSAGE_LENGTH = 300;

const logger = new Logger('http');

// 요청 경로만 남긴다 — 쿼리스트링에는 OAuth code/토큰이 실릴 수 있다.
export function pathForLog(rawUrl: string | undefined): string {
  return (rawUrl ?? '').split('?')[0] || '(unknown)';
}

// HttpException 응답 본문에서 사람이 읽을 메시지만 뽑는다. 요청 본문/쿠키/헤더는 찍지 않는다
// (사업자번호·OCR 결과 등 개인정보 로그 금지 — CLAUDE.md).
export function messageForLog(exception: HttpException): string {
  const body = exception.getResponse();
  let message: unknown = body;
  if (typeof body === 'object' && body !== null && 'message' in body) {
    message = (body as { message: unknown }).message;
  }
  const text = Array.isArray(message) ? message.join('; ') : String(message);
  return text.length > MAX_MESSAGE_LENGTH ? `${text.slice(0, MAX_MESSAGE_LENGTH)}…` : text;
}

// Nest는 4xx HttpException을 기본적으로 로그에 남기지 않아 CloudWatch에서 400/403 원인을
// 알 수 없다. 응답은 기본 필터 그대로 두고(BaseExceptionFilter), 로그만 추가한다.
// 형식: `400 POST /path - message` — Logger 컨텍스트는 `http`.
// 처리되지 않은 비-HttpException(500)은 BaseExceptionFilter가 이미 스택과 함께 로그한다.
@Catch()
export class HttpExceptionLoggingFilter extends BaseExceptionFilter {
  override catch(exception: unknown, host: ArgumentsHost): void {
    if (exception instanceof HttpException && host.getType() === 'http') {
      const req = host.switchToHttp().getRequest<RequestLike>();
      const status = exception.getStatus();
      const line = `${status} ${req.method ?? '?'} ${pathForLog(req.originalUrl ?? req.url)} - ${messageForLog(exception)}`;
      if (status >= 500) {
        logger.error(line, exception.stack);
      } else {
        logger.warn(line);
      }
    }
    super.catch(exception, host);
  }
}
