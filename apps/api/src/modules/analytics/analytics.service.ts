import type { ExamAnalyticsDto, OverviewAnalyticsDto } from '@eduforge/shared';
import { Injectable } from '@nestjs/common';
import type { AuthUser } from '../../common/auth.js';
import { round2 } from '../../common/utils.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ExamsService } from '../exams/exams.service.js';

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly exams: ExamsService,
  ) {}

  /** Số liệu tổng quan cho dashboard giảng viên (ADMIN xem toàn hệ thống). */
  async overview(user: AuthUser): Promise<OverviewAnalyticsDto> {
    const courseFilter = user.role === 'ADMIN' ? {} : { instructorId: user.id };
    const [courses, students, questions, exams, attempts, avg] = await Promise.all([
      this.prisma.course.count({ where: courseFilter }),
      this.prisma.enrollment
        .findMany({
          where: { course: courseFilter },
          distinct: ['userId'],
          select: { userId: true },
        })
        .then((rows) => rows.length),
      this.prisma.question.count({
        where: user.role === 'ADMIN' ? {} : { bank: { ownerId: user.id } },
      }),
      this.prisma.exam.count({ where: { course: courseFilter } }),
      this.prisma.examAttempt.count({ where: { exam: { course: courseFilter } } }),
      this.prisma.examAttempt.aggregate({
        where: { exam: { course: courseFilter }, status: { not: 'IN_PROGRESS' } },
        _avg: { percent: true },
      }),
    ]);
    return {
      courses,
      students,
      questions,
      exams,
      attempts,
      averagePercent: avg._avg.percent === null ? null : round2(avg._avg.percent),
    };
  }

  /** Phân tích kết quả một đề: điểm TB, tỉ lệ đạt, phổ điểm, độ khó thực tế từng câu. */
  async exam(examId: string, user: AuthUser): Promise<ExamAnalyticsDto> {
    const exam = await this.exams.assertCanManage(examId, user);
    const finished = { examId, status: { not: 'IN_PROGRESS' as const } };

    const [attemptCount, attempts, perQuestion] = await Promise.all([
      this.prisma.examAttempt.count({ where: { examId } }),
      this.prisma.examAttempt.findMany({
        where: finished,
        select: { percent: true, passed: true },
      }),
      this.prisma.attemptQuestion.groupBy({
        by: ['questionId', 'isCorrect'],
        where: { attempt: finished, isCorrect: { not: null } },
        _count: { _all: true },
      }),
    ]);

    const percents = attempts.map((a) => a.percent).filter((p): p is number => p !== null);
    const graded = attempts.filter((a) => a.passed !== null);

    const distribution = Array.from({ length: 10 }, (_, i) => ({
      bucket: `${i * 10}-${i * 10 + 10}%`,
      count: percents.filter((p) => Math.min(9, Math.floor(p / 10)) === i).length,
    }));

    const stats = new Map<string, { answered: number; correct: number }>();
    for (const row of perQuestion) {
      const s = stats.get(row.questionId) ?? { answered: 0, correct: 0 };
      s.answered += row._count._all;
      if (row.isCorrect) s.correct += row._count._all;
      stats.set(row.questionId, s);
    }
    const questions = await this.prisma.question.findMany({
      where: { id: { in: [...stats.keys()] } },
      select: { id: true, content: true, type: true, difficulty: true },
    });

    return {
      examId,
      examTitle: exam.title,
      attemptCount,
      submittedCount: attempts.length,
      averagePercent: percents.length
        ? round2(percents.reduce((a, b) => a + b, 0) / percents.length)
        : null,
      passRate: graded.length
        ? round2((graded.filter((a) => a.passed).length / graded.length) * 100)
        : null,
      distribution,
      questions: questions
        .map((q) => {
          const s = stats.get(q.id)!;
          return {
            questionId: q.id,
            content: q.content,
            type: q.type,
            difficulty: q.difficulty,
            answered: s.answered,
            correctRate: s.answered ? round2((s.correct / s.answered) * 100) : null,
          };
        })
        .sort((a, b) => (a.correctRate ?? 0) - (b.correctRate ?? 0)),
    };
  }
}
