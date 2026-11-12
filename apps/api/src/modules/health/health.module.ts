import type { HealthDto } from '@eduforge/shared';
import { InjectQueue } from '@nestjs/bullmq';
import { Controller, Get, Module } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Queue } from 'bullmq';
import { BullModule } from '@nestjs/bullmq';
import { Public } from '../../common/auth.js';
import { EXAM_TIMER_QUEUE } from '../../common/queues.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AiModule } from '../ai/ai.module.js';
import { ClaudeService } from '../ai/claude.service.js';
import { RagService } from '../ai/rag.service.js';
import { StorageService } from '../storage/storage.service.js';

const withTimeout = <T>(promise: Promise<T>, ms: number) =>
  Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly rag: RagService,
    private readonly claude: ClaudeService,
    @InjectQueue(EXAM_TIMER_QUEUE) private readonly queue: Queue,
  ) {}

  @Public()
  @Get()
  async check(): Promise<HealthDto> {
    const settle = async (fn: () => Promise<unknown>) => {
      try {
        return (await fn()) === false ? 'down' : 'up';
      } catch {
        return 'down';
      }
    };
    const [database, pgvector, redis, storage] = await Promise.all([
      settle(() => withTimeout(this.prisma.$queryRaw`SELECT 1`, 3000)),
      settle(() => this.rag.vectorExtensionReady()),
      settle(() => withTimeout(this.queue.getJobCounts(), 2000)),
      settle(() => withTimeout(this.storage.ping(), 3000)),
    ]);
    const services = {
      database,
      pgvector,
      redis,
      storage,
      claude: this.claude.enabled ? 'up' : 'down',
    } as const;
    const core = [database, redis];
    return {
      status: core.every((s) => s === 'up') ? 'ok' : 'degraded',
      uptimeSec: Math.round(process.uptime()),
      services,
    };
  }
}

@Module({
  imports: [BullModule.registerQueue({ name: EXAM_TIMER_QUEUE }), AiModule],
  controllers: [HealthController],
})
export class HealthModule {}
