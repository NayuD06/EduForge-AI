import type { QuestionBankDto, QuestionDto } from '@eduforge/shared';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../../common/auth.js';
import type { Prisma, Question, QuestionBank } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CoursesService } from '../courses/courses.service.js';
import { QuestionPayloadError, validateQuestionPayload } from '../exams/engine/question-schema.js';
import type {
  CreateQuestionBankDto,
  CreateQuestionDto,
  QuestionQueryDto,
  UpdateQuestionDto,
} from './question-bank.dto.js';

export function toQuestionDto(q: Question): QuestionDto {
  return {
    id: q.id,
    bankId: q.bankId,
    type: q.type,
    difficulty: q.difficulty,
    status: q.status,
    source: q.source,
    content: q.content,
    options: q.options as QuestionDto['options'],
    answer: q.answer as QuestionDto['answer'],
    explanation: q.explanation,
    tags: q.tags,
    points: q.points,
    sourceDocumentId: q.sourceDocumentId,
    createdAt: q.createdAt.toISOString(),
    updatedAt: q.updatedAt.toISOString(),
  };
}

function toBankDto(bank: QuestionBank & { _count?: { questions: number } }): QuestionBankDto {
  return {
    id: bank.id,
    name: bank.name,
    description: bank.description,
    courseId: bank.courseId,
    ownerId: bank.ownerId,
    questionCount: bank._count?.questions,
    createdAt: bank.createdAt.toISOString(),
  };
}

@Injectable()
export class QuestionBankService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly courses: CoursesService,
  ) {}

  async listBanks(user: AuthUser, courseId?: string) {
    const banks = await this.prisma.questionBank.findMany({
      where: {
        ...(courseId ? { courseId } : {}),
        ...(user.role === 'ADMIN' ? {} : { ownerId: user.id }),
      },
      include: { _count: { select: { questions: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return banks.map(toBankDto);
  }

  async getBank(id: string, user: AuthUser) {
    const bank = await this.assertBankAccess(id, user);
    const count = await this.prisma.question.count({ where: { bankId: id } });
    return toBankDto({ ...bank, _count: { questions: count } });
  }

  async createBank(user: AuthUser, dto: CreateQuestionBankDto) {
    if (dto.courseId) await this.courses.assertCanManage(dto.courseId, user);
    const bank = await this.prisma.questionBank.create({ data: { ...dto, ownerId: user.id } });
    return toBankDto({ ...bank, _count: { questions: 0 } });
  }

  async listQuestions(bankId: string, user: AuthUser, filter: QuestionQueryDto) {
    await this.assertBankAccess(bankId, user);
    const where: Prisma.QuestionWhereInput = {
      bankId,
      type: filter.type,
      difficulty: filter.difficulty,
      status: filter.status,
      ...(filter.tag ? { tags: { has: filter.tag } } : {}),
      ...(filter.search ? { content: { contains: filter.search, mode: 'insensitive' } } : {}),
    };
    const questions = await this.prisma.question.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    return questions.map(toQuestionDto);
  }

  async createQuestion(bankId: string, user: AuthUser, dto: CreateQuestionDto) {
    await this.assertBankAccess(bankId, user);
    const payload = this.validate(dto.type, dto.options, dto.answer);
    const question = await this.prisma.question.create({
      data: {
        bankId,
        type: dto.type,
        difficulty: dto.difficulty,
        status: dto.status,
        content: dto.content,
        options: payload.options as Prisma.InputJsonValue,
        answer: payload.answer as Prisma.InputJsonValue,
        explanation: dto.explanation,
        tags: dto.tags,
        points: dto.points,
      },
    });
    return toQuestionDto(question);
  }

  async updateQuestion(id: string, user: AuthUser, dto: UpdateQuestionDto) {
    const existing = await this.prisma.question.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Không tìm thấy câu hỏi');
    await this.assertBankAccess(existing.bankId, user);

    const type = dto.type ?? existing.type;
    const touchesPayload = dto.type || dto.options || dto.answer;
    const payload = touchesPayload
      ? this.validate(type, dto.options ?? existing.options, dto.answer ?? existing.answer)
      : null;

    const question = await this.prisma.question.update({
      where: { id },
      data: {
        type,
        difficulty: dto.difficulty,
        status: dto.status,
        content: dto.content,
        explanation: dto.explanation,
        tags: dto.tags,
        points: dto.points,
        ...(payload
          ? {
              options: payload.options as Prisma.InputJsonValue,
              answer: payload.answer as Prisma.InputJsonValue,
            }
          : {}),
      },
    });
    return toQuestionDto(question);
  }

  async deleteQuestion(id: string, user: AuthUser) {
    const existing = await this.prisma.question.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Không tìm thấy câu hỏi');
    await this.assertBankAccess(existing.bankId, user);
    // Câu hỏi đã xuất hiện trong bài thi thì lưu trữ thay vì xóa để giữ lịch sử chấm điểm
    const used = await this.prisma.attemptQuestion.count({ where: { questionId: id } });
    if (used > 0) {
      await this.prisma.question.update({ where: { id }, data: { status: 'ARCHIVED' } });
    } else {
      await this.prisma.question.delete({ where: { id } });
    }
    return { deleted: true as const };
  }

  async assertBankAccess(bankId: string, user: AuthUser) {
    const bank = await this.prisma.questionBank.findUnique({ where: { id: bankId } });
    if (!bank) throw new NotFoundException('Không tìm thấy ngân hàng câu hỏi');
    if (user.role !== 'ADMIN' && bank.ownerId !== user.id) {
      throw new ForbiddenException('Bạn không sở hữu ngân hàng câu hỏi này');
    }
    return bank;
  }

  private validate(type: Question['type'], options: unknown, answer: unknown) {
    try {
      return validateQuestionPayload(type, options, answer);
    } catch (error) {
      if (error instanceof QuestionPayloadError) throw new BadRequestException(error.message);
      throw error;
    }
  }
}
