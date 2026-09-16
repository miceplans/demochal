import { NestFactory } from '@nestjs/core';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { env } from './config/env.js';
import { InputSecurityPipe } from './common/security/input-security.pipe.js';

// Shared by main.ts (persistent server) and api/index.js (Vercel serverless entry)
// so both hosting modes bootstrap the exact same app.
export async function createApp(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: env.frontendOrigins,
    credentials: true,
  });
  app.useGlobalPipes(
    new InputSecurityPipe(),
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  // Also the source for packages/api-client's future OpenAPI-generated types.
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder().setTitle('semochal API').setVersion('0.0.1').build(),
  );
  SwaggerModule.setup('docs', app, document);

  return app;
}
