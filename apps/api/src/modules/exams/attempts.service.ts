import type {
  AttemptQuestionView,
  AttemptResult,
  AttemptResultQuestion,
  AttemptSummary,
  AttemptView,
  QuestionType,
  SaveAnswersResult,
} from '@eduforge/shared';
import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Queue } from 'bullmq';
import type { AuthUser } from '../../common/auth.js';
import { EXAM_TIMER_QUEUE, ExamTimerJob } from '../../common/queues.js';
import { round2, toIso } from '../../common/utils.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  applyOptionOrder,
  buildFixedExam,
  type OptionOrder,
  shuffleOptionOrder,
} from './engine/generator.js';
import { gradeResponse, summarize } from './engine/grading.js';
import { parseResponse, QuestionPayloadError } from './engine/question-schema.js';
import { createRng, randomSeed } from './engine/random.js';
import { computeExpiresAt, isExpired, SUBMIT_GRACE_MS } from './engine/timer.js';
import { ExamGateway } from './exam.gateway.js';
import { ExamsService } from './exams.service.js';
import type { SaveAnswersDto } from './exams.dto.js';

const attemptInclude = {
  exam: {
    select: {
      id: true,
      title: true,
      showResult: true,
      passingPercent: true,
      courseId: true,
      course: { select: { instructorId: true } },
    },
  },
  questions: {
    orderBy: { order: 'asc' },
    include: {
      question: {
        select: {
          id: true,
          type: true,
          content: true,
          options: true,
          answer: true,
          explanation: true,
        },
      },
    },
  },
} satisfies Prisma.ExamAttemptInclude;

type AttemptWithQuestions = Prisma.ExamAttemptGetPayload<{ include: typeof attemptInclude }>;

@Injectable()
export class AttemptsService {
  private readonly logger = new Logger(AttemptsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly exams: ExamsService,
    private readonly gateway: ExamGateway,
    @InjectQueue(EXAM_TIMER_QUEUE) private readonly timerQueue: Queue,
  ) {}

  // ───────────────────────── Bắt đầu / tiếp tục ─────────────────────────

  async start(examId: string, user: AuthUser): Promise<AttemptView> {
    const exam = await this.prisma.exam.findUnique({
      where: { id: examId },
      include: { rules: { orderBy: { order: 'asc' } }, questions: true, course: true },
    });
    if (!exam || exam.status !== 'PUBLISHED' || exam.course.status !== 'PUBLISHED') {
      throw new NotFoundException('Đề thi không tồn tại hoặc chưa mở');
    }
    const now = new Date();
    if (exam.startAt && now < exam.startAt) throw new BadRequestException('Đề thi chưa đến giờ mở');
    if (exam.endAt && now >= exam.endAt) throw new BadRequestException('Đề thi đã đóng');

    // Tiếp tục lượt đang làm (mất mạng, tải lại trang, đổi thiết bị...)
    const inProgress = await this.prisma.examAttempt.findFirst({
      where: { examId, userId: user.id, status: 'IN_PROGRESS' },
    });
    if (inProgress) {
      if (!isExpired(inProgress.expiresAt, now)) return this.view(inProgress.id, user);
      await this.finalize(inProgress.id, { auto: true });
    }

    if (exam.maxAttempts > 0) {
      const used = await this.prisma.examAttempt.count({ where: { examId, userId: user.id } });
      if (used >= exam.maxAttempts) throw new ForbiddenException('Bạn đã hết số lượt làm bài');
    }

    // Tự ghi danh khi vào thi
    await this.prisma.enrollment.upsert({
      where: { userId_courseId: { userId: user.id, courseId: exam.courseId } },
      create: { userId: user.id, courseId: exam.courseId },
      update: {},
    });

    const seed = randomSeed();
    const items =
      exam.mode === 'RANDOM'
        ? await this.exams.generateFromRules(exam.rules, seed, exam.shuffleQuestions)
        : buildFixedExam(
            exam.questions.map((q) => ({
              questionId: q.questionId,
              order: q.order,
              points: q.points ?? NaN,
            })),
            seed,
            { shuffleQuestions: exam.shuffleQuestions },
          );
    if (items.length === 0) throw new BadRequestException('Đề thi chưa có câu hỏi');

    const questions = await this.prisma.question.findMany({
      where: { id: { in: items.map((i) => i.questionId) } },
      select: { id: true, type: true, options: true, points: true },
    });
    const byId = new Map(questions.map((q) => [q.id, q]));
    const rng = createRng(seed ^ 0x5bd1e995);

    const rows = items.map((item) => {
      const q = byId.get(item.questionId)!;
      const points = Number.isNaN(item.points) ? q.points : item.points;
      const optionOrder = shuffleOptionOrder(q.type, q.options, rng, exam.shuffleOptions);
      return {
        questionId: q.id,
        order: item.order,
        points,
        optionOrder: (optionOrder ?? undefined) as Prisma.InputJsonValue | undefined,
      };
    });

    const expiresAt = computeExpiresAt(now, exam.durationSec, exam.endAt);
    const attempt = await this.prisma.examAttempt.create({
      data: {
        examId,
        userId: user.id,
        seed,
        startedAt: now,
        expiresAt,
        maxScore: round2(rows.reduce((s, r) => s + r.points, 0)),
        questions: { create: rows },
      },
    });

    await this.scheduleExpiry(attempt.id, expiresAt);
    return this.view(attempt.id, user);
  }

  // ───────────────────────── Xem / lưu tiến trình ─────────────────────────

  async view(attemptId: string, user: AuthUser): Promise<AttemptView> {
    let attempt = await this.load(attemptId, user);
    if (attempt.status === 'IN_PROGRESS' && isExpired(attempt.expiresAt)) {
      await this.finalize(attempt.id, { auto: true });
      attempt = await this.load(attemptId, user);
    }
    return {
      id: attempt.id,
      examId: attempt.examId,
      examTitle: attempt.exam.title,
      status: attempt.status,
      startedAt: attempt.startedAt.toISOString(),
      expiresAt: attempt.expiresAt.toISOString(),
      submittedAt: toIso(attempt.submittedAt),
      serverNow: new Date().toISOString(),
      questions: attempt.questions.map((aq) => this.toQuestionView(aq)),
    };
  }

  async saveAnswers(
    attemptId: string,
    user: AuthUser,
    dto: SaveAnswersDto,
  ): Promise<SaveAnswersResult> {
    const attempt = await this.load(attemptId, user, { ownerOnly: true });
    if (attempt.status !== 'IN_PROGRESS') throw new ConflictException('Bài thi đã được nộp');
    if (isExpired(attempt.expiresAt, new Date(), SUBMIT_GRACE_MS)) {
      await this.finalize(attempt.id, { auto: true });
      throw new ConflictException('Đã hết giờ làm bài – bài thi đã được tự động nộp');
    }

    const byId = new Map(attempt.questions.map((aq) => [aq.id, aq]));
    const now = new Date();
    const updates = dto.answers.map((item) => {
      const aq = byId.get(item.attemptQuestionId);
      if (!aq)
        throw new BadRequestException(`Câu hỏi ${item.attemptQuestionId} không thuộc bài thi này`);
      let response: unknown;
      try {
        response = parseResponse(aq.question.type, item.response);
      } catch (error) {
        if (error instanceof QuestionPayloadError) throw new BadRequestException(error.message);
        throw error;
      }
      return this.prisma.attemptQuestion.update({
        where: { id: aq.id },
        data: {
          response:
            response === null
              ? (null as unknown as Prisma.InputJsonValue)
              : (response as Prisma.InputJsonValue),
          answeredAt: response === null ? null : now,
          ...(item.flagged !== undefined ? { flagged: item.flagged } : {}),
        },
      });
    });

    await this.prisma.$transaction([
      ...updates,
      this.prisma.examAttempt.update({ where: { id: attempt.id }, data: { lastSavedAt: now } }),
    ]);

    const savedAt = now.toISOString();
    this.gateway.emitSaved(attempt.id, {
      savedAt,
      attemptQuestionIds: dto.answers.map((a) => a.attemptQuestionId),
    });
    return { savedAt, saved: updates.length, expiresAt: attempt.expiresAt.toISOString() };
  }

  // ───────────────────────── Nộp bài & chấm điểm ─────────────────────────

  async submit(attemptId: string, user: AuthUser): Promise<AttemptResult> {
    await this.load(attemptId, user, { ownerOnly: true });
    await this.finalize(attemptId, { auto: false });
    return this.result(attemptId, user);
  }

  /** Được gọi bởi BullMQ khi tới hạn nộp. */
  async autoSubmitIfExpired(attemptId: string) {
    const attempt = await this.prisma.examAttempt.findUnique({ where: { id: attemptId } });
    if (!attempt || attempt.status !== 'IN_PROGRESS') return false;
    if (!isExpired(attempt.expiresAt)) {
      // Job chạy sớm (lệch giờ) → hẹn lại
      await this.scheduleExpiry(attempt.id, attempt.expiresAt);
      return false;
    }
    await this.finalize(attempt.id, { auto: true });
    return true;
  }

  /** Quét định kỳ phòng trường hợp mất job trong Redis. */
  async sweepExpired() {
    const expired = await this.prisma.examAttempt.findMany({
      where: { status: 'IN_PROGRESS', expiresAt: { lt: new Date(Date.now() - SUBMIT_GRACE_MS) } },
      select: { id: true },
      take: 200,
    });
    for (const { id } of expired) await this.finalize(id, { auto: true });
    return expired.length;
  }

  /**
   * Chốt bài thi: "giành quyền" chuyển trạng thái bằng updateMany có điều kiện (an toàn khi
   * người dùng bấm nộp đúng lúc job hết giờ chạy), sau đó chấm tự động từng câu.
   */
  private async finalize(attemptId: string, opts: { auto: boolean }) {
    const outcome = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.examAttempt.updateMany({
        where: { id: attemptId, status: 'IN_PROGRESS' },
        data: { status: 'SUBMITTED', submittedAt: new Date(), autoSubmitted: opts.auto },
      });
      if (claimed.count === 0) return null;

      const attempt = await tx.examAttempt.findUniqueOrThrow({
        where: { id: attemptId },
        include: {
          exam: { select: { passingPercent: true } },
          questions: { include: { question: { select: { type: true, answer: true } } } },
        },
      });

      const graded = attempt.questions.map((aq) => ({
        aq,
        points: aq.points,
        outcome: gradeResponse(aq.question.type, aq.question.answer, aq.response, aq.points),
      }));
      for (const { aq, outcome } of graded) {
        await tx.attemptQuestion.update({
          where: { id: aq.id },
          data: {
            score: outcome.score,
            isCorrect: outcome.isCorrect,
            needsManualGrading: outcome.needsManualGrading,
          },
        });
      }

      const totals = summarize(graded);
      const fullyGraded = totals.pendingManual === 0;
      return tx.examAttempt.update({
        where: { id: attemptId },
        data: {
          status: fullyGraded ? 'GRADED' : 'SUBMITTED',
          score: totals.score,
          maxScore: totals.maxScore,
          percent: totals.percent,
          passed: fullyGraded ? totals.percent >= attempt.exam.passingPercent : null,
        },
      });
    });

    if (outcome) {
      await this.timerQueue.remove(this.expiryJobId(attemptId)).catch(() => undefined);
      this.gateway.emitSubmitted(attemptId, { status: outcome.status, autoSubmitted: opts.auto });
      this.logger.log(
        `Đã chấm lượt thi ${attemptId}: ${outcome.score}/${outcome.maxScore} (auto=${opts.auto})`,
      );
    }
  }

  async result(attemptId: string, user: AuthUser): Promise<AttemptResult> {
    const attempt = await this.load(attemptId, user);
    if (attempt.status === 'IN_PROGRESS') throw new BadRequestException('Bài thi chưa được nộp');

    const isOwnerStudent = user.role === 'STUDENT';
    const showDetails = attempt.exam.showResult || !isOwnerStudent;
    return {
      id: attempt.id,
      examId: attempt.examId,
      examTitle: attempt.exam.title,
      status: attempt.status,
      autoSubmitted: attempt.autoSubmitted,
      startedAt: attempt.startedAt.toISOString(),
      submittedAt: toIso(attempt.submittedAt),
      score: attempt.score,
      maxScore: attempt.maxScore,
      percent: attempt.percent,
      passed: attempt.passed,
      questions: showDetails
        ? attempt.questions.map((aq) => ({
            ...this.toQuestionView(aq),
            isCorrect: aq.isCorrect,
            score: aq.score,
            needsManualGrading: aq.needsManualGrading,
            correctAnswer: aq.question.answer as AttemptResultQuestion['correctAnswer'],
            explanation: aq.question.explanation,
          }))
        : null,
    };
  }

  async mine(user: AuthUser): Promise<AttemptSummary[]> {
    const attempts = await this.prisma.examAttempt.findMany({
      where: { userId: user.id },
      include: { exam: { select: { title: true } } },
      orderBy: { startedAt: 'desc' },
      take: 100,
    });
    return attempts.map((a) => ({
      id: a.id,
      examId: a.examId,
      examTitle: a.exam.title,
      status: a.status,
      startedAt: a.startedAt.toISOString(),
      submittedAt: toIso(a.submittedAt),
      percent: a.percent,
      passed: a.passed,
    }));
  }

  // ───────────────────────── Helpers ─────────────────────────

  private async load(attemptId: string, user: AuthUser, opts: { ownerOnly?: boolean } = {}) {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: attemptInclude,
    });
    if (!attempt) throw new NotFoundException('Không tìm thấy lượt thi');
    const isOwner = attempt.userId === user.id;
    const isManager = user.role === 'ADMIN' || attempt.exam.course.instructorId === user.id;
    if (!isOwner && (opts.ownerOnly || !isManager))
      throw new NotFoundException('Không tìm thấy lượt thi');
    return attempt;
  }

  private toQuestionView(aq: AttemptWithQuestions['questions'][number]): AttemptQuestionView {
    return {
      id: aq.id,
      questionId: aq.questionId,
      order: aq.order,
      type: aq.question.type as QuestionType,
      content: aq.question.content,
      options: applyOptionOrder(
        aq.question.options,
        aq.optionOrder as OptionOrder | null,
      ) as AttemptQuestionView['options'],
      points: aq.points,
      response: (aq.response ?? null) as AttemptQuestionView['response'],
      flagged: aq.flagged,
    };
  }

  private expiryJobId(attemptId: string) {
    return `expire-${attemptId}`;
  }

  private async scheduleExpiry(attemptId: string, expiresAt: Date) {
    const jobId = this.expiryJobId(attemptId);
    await this.timerQueue.remove(jobId).catch(() => undefined);
    await this.timerQueue.add(
      ExamTimerJob.EXPIRE,
      { attemptId },
      {
        jobId,
        delay: Math.max(0, expiresAt.getTime() - Date.now()) + SUBMIT_GRACE_MS,
        removeOnComplete: true,
        removeOnFail: 100,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      },
    );
  }
}
