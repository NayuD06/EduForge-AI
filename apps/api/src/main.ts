import 'reflect-metadata';
import { API_PREFIX } from '@eduforge/shared';
import { type INestApplicationContext, Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { ServerOptions } from 'socket.io';
import { AppModule } from './app.module.js';
import type { Env } from './config/env.js';

/** Socket.IO dùng chung danh sách CORS với REST. */
class SocketIoAdapter extends IoAdapter {
  constructor(
    app: INestApplicationContext,
    private readonly origins: string[],
  ) {
    super(app);
  }

  override createIOServer(port: number, options?: ServerOptions) {
    return super.createIOServer(port, {
      ...options,
      cors: { origin: this.origins, credentials: true },
    } as ServerOptions);
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get<ConfigService<Env, true>>(ConfigService);
  const port = config.get('PORT', { infer: true });
  const origins = config
    .get('CORS_ORIGINS', { infer: true })
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.setGlobalPrefix(API_PREFIX);
  app.enableCors({ origin: origins, credentials: true });
  app.useWebSocketAdapter(new SocketIoAdapter(app, origins));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableShutdownHooks();

  const swagger = new DocumentBuilder()
    .setTitle('EduForge API')
    .setDescription('Khóa học, ngân hàng câu hỏi, Exam Engine, phân tích kết quả và AI')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swagger));

  await app.listen(port);
  const logger = new Logger('Bootstrap');
  logger.log(`🚀 API:     http://localhost:${port}/${API_PREFIX}`);
  logger.log(`📚 Swagger: http://localhost:${port}/docs`);
}

await bootstrap();
