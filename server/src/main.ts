import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { env } from './config/env.js';

// HTTP API entry point — sits behind the ALB, ALB inbound only.
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Also the source for packages/api-client's future OpenAPI-generated types.
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder().setTitle('semochal API').setVersion('0.0.1').build(),
  );
  SwaggerModule.setup('docs', app, document);

  await app.listen(env.port);
}

await bootstrap();
