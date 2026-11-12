import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { EXAM_TIMER_QUEUE } from '../../common/queues.js';
import { AttemptsService } from './attempts.service.js';
import { ExamTimerProcessor } from './exam-timer.processor.js';
import { ExamGateway } from './exam.gateway.js';
import { AttemptsController, ExamsController } from './exams.controller.js';
import { ExamsService } from './exams.service.js';

@Module({
  imports: [BullModule.registerQueue({ name: EXAM_TIMER_QUEUE })],
  controllers: [ExamsController, AttemptsController],
  providers: [ExamsService, AttemptsService, ExamGateway, ExamTimerProcessor],
  exports: [ExamsService, AttemptsService],
})
export class ExamsModule {}
