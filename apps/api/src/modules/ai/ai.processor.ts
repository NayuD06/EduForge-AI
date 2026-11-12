import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { AI_QUEUE, AiJob } from '../../common/queues.js';
import { AiService, type GenerateJobData } from './ai.service.js';

/** Worker xử lý tác vụ AI nặng ngoài luồng request (đọc PDF, gọi Claude). */
@Processor(AI_QUEUE, { concurrency: 2 })
export class AiProcessor extends WorkerHost {
  private readonly logger = new Logger(AiProcessor.name);

  constructor(private readonly ai: AiService) {
    super();
  }

  async process(job: Job) {
    this.logger.log(`Bắt đầu job ${job.name} #${job.id}`);
    switch (job.name) {
      case AiJob.INGEST_DOCUMENT:
        return this.ai.ingestDocument((job.data as { documentId: string }).documentId);
      case AiJob.GENERATE_QUESTIONS:
        return this.ai.generateQuestions(job.data as GenerateJobData);
      default:
        this.logger.warn(`Job không xác định: ${job.name}`);
        return null;
    }
  }
}
