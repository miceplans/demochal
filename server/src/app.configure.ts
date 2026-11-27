import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { Express } from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { HttpExceptionLoggingFilter } from './common/http/http-exception-logging.filter.js';
import { InputSecurityPipe } from './common/security/input-security.pipe.js';
import { SkipInputSecurityInterceptor } from './common/security/skip-input-security.interceptor.js';
import { signedClientIpMiddleware } from './common/throttling/signed-client-ip.js';

// Shared Nest configuration for the main.ts bootstrap and createApp() factory.
export function configureApp(app: INestApplication): void {
  // The API sits behind exactly one ALB, which appends the peer address to
  // X-Forwarded-For. One hop yields the ALB-observed address; the middleware
  // below replaces req.ip only when the frontend's signed client IP is valid.
  // Trusting more hops would let direct API callers spoof X-Forwarded-For.
  // https://expressjs.com/en/guide/behind-proxies.html
  (app.getHttpAdapter().getInstance() as Express).set('trust proxy', 1);
  app.use(signedClientIpMiddleware(env.apiProxyIpSecret));
  app.use(helmet());
  app.enableCors({
    origin: env.frontendOrigins,
    credentials: true,
  });
  app.useGlobalPipes(
    new InputSecurityPipe(),
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalInterceptors(new SkipInputSecurityInterceptor(new Reflector()));
  // 4xx/5xx 원인을 CloudWatch에서 볼 수 있도록 로그만 추가한다(응답은 기본 필터와 동일).
  app.useGlobalFilters(new HttpExceptionLoggingFilter(app.getHttpAdapter()));

  // Also the source for packages/api-client's future OpenAPI-generated types.
  // 비밀번호/키가 아닌 엔드포인트 계약만 담지만, 외부에 드러낼지는 SWAGGER_ENABLED로
  // 제어한다 — 기본은 production에서만 끈다(see config/env.ts).
  if (env.swaggerEnabled) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('semochal API').setVersion('0.0.1').build(),
    );
    SwaggerModule.setup('docs', app, document);
  }
}
