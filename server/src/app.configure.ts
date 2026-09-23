import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { env } from './config/env.js';
import { InputSecurityPipe } from './common/security/input-security.pipe.js';
import { SkipInputSecurityInterceptor } from './common/security/skip-input-security.interceptor.js';

// Applied by every bootstrap path (main.ts persistent server, api/index.js
// Vercel serverless entry) so both hosting modes run the exact same app.
export function configureApp(app: INestApplication): void {
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
