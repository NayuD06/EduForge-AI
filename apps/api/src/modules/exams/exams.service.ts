import type { ExamDto } from '@eduforge/shared';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { type AuthUser, isStaff } from '../../common/auth.js';
import { round2 } from '../../common/utils.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CoursesService } from '../courses/courses.service.js';
import { generateRandomExam, InsufficientQuestionsError } from './engine/generator.js';
import { randomSeed } from './engine/random.js';
import type { CreateExamDto, UpdateExamDto } from './exams.dto.js';

const examInclude = {
  rules: { orderBy: { order: 'asc' } },
  questions: { orderBy: { order: 'asc' } },
} satisfies Prisma.ExamInclude;

type ExamWithRelations = Prisma.ExamGetPayload<{ include: typeof examInclude }>;

export function toExamDto(exam: ExamWithRelations): ExamDto {
  return {
    id: exam.id,
    courseId: exam.courseId,
    title: exam.title,
    description: exam.description,
    mode: exam.mode,
    status: exam.status,
    durationSec: exam.durationSec,
    passingPercent: exam.passingPercent,
    maxAttempts: exam.maxAttempts,
    shuffleQuestions: exam.shuffleQuestions,
    shuffleOptions: exam.shuffleOptions,
    showResult: exam.showResult,
    startAt: exam.startAt?.toISOString() ?? null,
    endAt: exam.endAt?.toISOString() ?? null,
    rules: exam.rules.map((r) => ({
      id: r.id,
      bankId: r.bankId,
      count: r.count,
      type: r.type,
      difficulty: r.difficulty,
      tags: r.tags,
      pointsPerQuestion: r.pointsPerQuestion,
    })),
    questionIds: exam.questions.map((q) => q.questionId),
    createdAt: exam.createdAt.toISOString(),
  };
}

@Injectable()
export class ExamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly courses: CoursesService,
  ) {}

  async list(user: AuthUser, courseId?: string) {
    const exams = await this.prisma.exam.findMany({
      where: {
        ...(courseId ? { courseId } : {}),
        ...(isStaff(user)
          ? user.role === 'ADMIN'
            ? {}
            : { course: { instructorId: user.id } }
          : { status: 'PUBLISHED', course: { status: 'PUBLISHED' } }),
      },
      include: examInclude,
      orderBy: { createdAt: 'desc' },
    });
    return exams.map(toExamDto);
  }

  async get(id: string, user: AuthUser) {
    const exam = await this.prisma.exam.findUnique({
      where: { id },
      include: { ...examInclude, course: true },
    });
    if (!exam) throw new NotFoundException('Không tìm thấy đề thi');
    const owner = user.role === 'ADMIN' || exam.course.instructorId === user.id;
    if (!owner && exam.status !== 'PUBLISHED') throw new NotFoundException('Không tìm thấy đề thi');
    const dto = toExamDto(exam);
    // Ẩn cấu trúc đề với thí sinh
    return owner ? dto : { ...dto, rules: [], questionIds: [] };
  }

  async create(user: AuthUser, dto: CreateExamDto) {
    await this.courses.assertCanManage(dto.courseId, user);
    await this.validateStructure(dto.mode, dto.rules, dto.questionIds, user);

    const exam = await this.prisma.exam.create({
      data: {
        courseId: dto.courseId,
        title: dto.title,
        description: dto.description,
        mode: dto.mode,
        durationSec: dto.durationSec,
        passingPercent: dto.passingPercent,
        maxAttempts: dto.maxAttempts,
        shuffleQuestions: dto.shuffleQuestions,
        shuffleOptions: dto.shuffleOptions,
        showResult: dto.showResult,
        startAt: dto.startAt ? new Date(dto.startAt) : undefined,
        endAt: dto.endAt ? new Date(dto.endAt) : undefined,
        rules: {
          create: (dto.rules ?? []).map((r, order) => ({
            bankId: r.bankId,
            count: r.count,
            type: r.type,
            difficulty: r.difficulty,
            tags: r.tags,
            pointsPerQuestion: r.pointsPerQuestion,
            order,
          })),
        },
        questions: {
          create: (dto.questionIds ?? []).map((questionId, order) => ({ questionId, order })),
        },
      },
      include: examInclude,
    });
    return toExamDto(exam);
  }

  async update(id: string, user: AuthUser, dto: UpdateExamDto) {
    const exam = await this.assertCanManage(id, user);
    const mode = dto.mode ?? exam.mode;
    if (dto.rules || dto.questionIds || dto.mode) {
      await this.validateStructure(
        mode,
        dto.rules ?? exam.rules,
        dto.questionIds ?? exam.questions.map((q) => q.questionId),
        user,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.rules) {
        await tx.examRule.deleteMany({ where: { examId: id } });
        await tx.examRule.createMany({
          data: dto.rules.map((r, order) => ({
            examId: id,
            bankId: r.bankId,
            count: r.count,
            type: r.type,
            difficulty: r.difficulty,
            tags: r.tags ?? [],
            pointsPerQuestion: r.pointsPerQuestion,
            order,
          })),
        });
      }
      if (dto.questionIds) {
        await tx.examQuestion.deleteMany({ where: { examId: id } });
        await tx.examQuestion.createMany({
          data: dto.questionIds.map((questionId, order) => ({ examId: id, questionId, order })),
        });
      }
      return tx.exam.update({
        where: { id },
        data: {
          title: dto.title,
          description: dto.description,
          mode: dto.mode,
          durationSec: dto.durationSec,
          passingPercent: dto.passingPercent,
          maxAttempts: dto.maxAttempts,
          shuffleQuestions: dto.shuffleQuestions,
          shuffleOptions: dto.shuffleOptions,
          showResult: dto.showResult,
          startAt: dto.startAt ? new Date(dto.startAt) : undefined,
          endAt: dto.endAt ? new Date(dto.endAt) : undefined,
        },
        include: examInclude,
      });
    });
    return toExamDto(updated);
  }

  async publish(id: string, user: AuthUser) {
    const exam = await this.assertCanManage(id, user);
    await this.preview(id, user); // đảm bảo ngân hàng đủ câu trước khi mở đề
    const updated = await this.prisma.exam.update({
      where: { id: exam.id },
      data: { status: 'PUBLISHED' },
      include: examInclude,
    });
    return toExamDto(updated);
  }

  /** Sinh thử một đề (không lưu) để giảng viên kiểm tra quy tắc. */
  async preview(id: string, user: AuthUser) {
    const exam = await this.assertCanManage(id, user);
    const items =
      exam.mode === 'RANDOM'
        ? await this.generateFromRules(exam.rules, randomSeed(), exam.shuffleQuestions)
        : exam.questions.map((q) => ({
            questionId: q.questionId,
            order: q.order,
            points: q.points,
          }));

    const questions = await this.prisma.question.findMany({
      where: { id: { in: items.map((i) => i.questionId) } },
      select: { id: true, type: true, content: true, points: true },
    });
    const byId = new Map(questions.map((q) => [q.id, q]));
    return {
      total: items.length,
      maxScore: round2(
        items.reduce((s, i) => s + (i.points ?? byId.get(i.questionId)?.points ?? 0), 0),
      ),
      questions: items.map((i) => ({
        id: i.questionId,
        type: byId.get(i.questionId)?.type ?? 'SINGLE_CHOICE',
        content: byId.get(i.questionId)?.content ?? '',
      })),
    };
  }

  /** Dùng bởi AttemptsService khi phát đề. */
  async generateFromRules(
    rules: Array<{
      bankId: string;
      count: number;
      type: ExamDto['rules'][number]['type'];
      difficulty: ExamDto['rules'][number]['difficulty'];
      tags: string[];
      pointsPerQuestion: number | null;
    }>,
    seed: number,
    shuffleQuestions: boolean,
  ) {
    const pool = await this.prisma.question.findMany({
      where: { bankId: { in: [...new Set(rules.map((r) => r.bankId))] }, status: 'ACTIVE' },
      select: { id: true, bankId: true, type: true, difficulty: true, tags: true, points: true },
    });
    try {
      return generateRandomExam(rules, pool, seed, { shuffleQuestions });
    } catch (error) {
      if (error instanceof InsufficientQuestionsError) throw new BadRequestException(error.message);
      throw error;
    }
  }

  async assertCanManage(id: string, user: AuthUser) {
    const exam = await this.prisma.exam.findUnique({ where: { id }, include: examInclude });
    if (!exam) throw new NotFoundException('Không tìm thấy đề thi');
    await this.courses.assertCanManage(exam.courseId, user);
    return exam;
  }

  private async validateStructure(
    mode: CreateExamDto['mode'],
    rules: Array<{ bankId: string }> | undefined,
    questionIds: string[] | undefined,
    user: AuthUser,
  ) {
    if (mode === 'RANDOM') {
      if (!rules?.length)
        throw new BadRequestException('Đề ngẫu nhiên cần ít nhất một quy tắc (rules)');
      const bankIds = [...new Set(rules.map((r) => r.bankId))];
      const banks = await this.prisma.questionBank.findMany({ where: { id: { in: bankIds } } });
      if (banks.length !== bankIds.length)
        throw new BadRequestException('Có ngân hàng câu hỏi không tồn tại');
      if (user.role !== 'ADMIN' && banks.some((b) => b.ownerId !== user.id)) {
        throw new BadRequestException('Chỉ dùng được ngân hàng câu hỏi của bạn');
      }
    } else {
      if (!questionIds?.length)
        throw new BadRequestException('Đề cố định cần danh sách questionIds');
      const count = await this.prisma.question.count({ where: { id: { in: questionIds } } });
      if (count !== new Set(questionIds).size)
        throw new BadRequestException('Có câu hỏi không tồn tại');
    }
  }
}
