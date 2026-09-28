import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { Express } from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { InputSecurityPipe } from './common/security/input-security.pipe.js';
import { SkipInputSecurityInterceptor } from './common/security/skip-input-security.interceptor.js';

// Applied by every bootstrap path (main.ts persistent server, api/index.js
// Vercel serverless entry) so both hosting modes run the exact same app.
export function configureApp(app: INestApplication): void {
  // The API sits behind exactly one ALB, which appends the peer address to
  // X-Forwarded-For. Trusting one hop makes req.ip (the throttler key) that
  // ALB-observed address; trusting more would let clients spoof it via the header.
  // https://expressjs.com/en/guide/behind-proxies.html
  (app.getHttpAdapter().getInstance() as Express).set('trust proxy', 1);
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

  // Also the source for packages/api-client's future OpenAPI-generated types.
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder().setTitle('semochal API').setVersion('0.0.1').build(),
  );
  SwaggerModule.setup('docs', app, document);
}
