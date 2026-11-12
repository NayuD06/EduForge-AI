import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard, RolesGuard } from './common/auth.js';
import { type Env, validateEnv } from './config/env.js';
import { AiModule } from './modules/ai/ai.module.js';
import { AnalyticsModule } from './modules/analytics/analytics.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { CoursesModule } from './modules/courses/courses.module.js';
import { ExamsModule } from './modules/exams/exams.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { QuestionBankModule } from './modules/question-bank/question-bank.module.js';
import { StorageModule } from './modules/storage/storage.service.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validateEnv }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        connection: { url: config.get('REDIS_URL', { infer: true }), maxRetriesPerRequest: null },
      }),
    }),
    PrismaModule,
    StorageModule,
    AuthModule,
    CoursesModule,
    QuestionBankModule,
    ExamsModule,
    AnalyticsModule,
    AiModule,
    HealthModule,
  ],
  providers: [
    // Mặc định mọi route cần đăng nhập; dùng @Public() để mở, @Roles() để giới hạn vai trò.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
