import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, type OnApplicationBootstrap } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { EXAM_TIMER_QUEUE, ExamTimerJob } from '../../common/queues.js';
import { AttemptsService } from './attempts.service.js';

/**
 * Worker hàng đợi hẹn giờ của Exam Engine:
 *  - `expire-attempt`: delayed job tạo khi bắt đầu thi, tự nộp bài khi hết giờ
 *  - `sweep-expired`: chạy mỗi phút, dọn các lượt quá hạn nếu job bị mất
 */
@Processor(EXAM_TIMER_QUEUE)
export class ExamTimerProcessor extends WorkerHost implements OnApplicationBootstrap {
  private readonly logger = new Logger(ExamTimerProcessor.name);

  constructor(
    private readonly attempts: AttemptsService,
    @InjectQueue(EXAM_TIMER_QUEUE) private readonly queue: Queue,
  ) {
    super();
  }

  async onApplicationBootstrap() {
    await this.queue.upsertJobScheduler(
      ExamTimerJob.SWEEP,
      { every: 60_000 },
      { name: ExamTimerJob.SWEEP, opts: { removeOnComplete: true, removeOnFail: 50 } },
    );
  }

  async process(job: Job<{ attemptId?: string }>) {
    switch (job.name) {
      case ExamTimerJob.EXPIRE:
        return job.data.attemptId ? this.attempts.autoSubmitIfExpired(job.data.attemptId) : false;
      case ExamTimerJob.SWEEP: {
        const count = await this.attempts.sweepExpired();
        if (count) this.logger.log(`Đã tự nộp ${count} lượt thi quá hạn`);
        return count;
      }
      default:
        this.logger.warn(`Job không xác định: ${job.name}`);
        return null;
    }
  }
}
