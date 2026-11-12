import { randomUUID } from 'node:crypto';
import type {
  AiJobDto,
  CourseDocumentDto,
  ExplainAnswerResult,
  QuestionAnswerKey,
  QuestionOptions,
} from '@eduforge/shared';
import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Queue } from 'bullmq';
import type { AuthUser } from '../../common/auth.js';
import { AI_QUEUE, AiJob } from '../../common/queues.js';
import type { Document, Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CoursesService } from '../courses/courses.service.js';
import { describeAnswer, describeOptions } from '../exams/engine/describe.js';
import { validateQuestionPayload } from '../exams/engine/question-schema.js';
import { QuestionBankService } from '../question-bank/question-bank.service.js';
import { AI_QUESTION_TYPES, type GenerateQuestionsDto } from './ai.dto.js';
import { ClaudeService, type GeneratedQuestion } from './claude.service.js';
import { RagService } from './rag.service.js';
import { StorageService } from '../storage/storage.service.js';

/** Giới hạn của Claude API cho PDF: 32MB / request. */
export const MAX_PDF_BYTES = 32 * 1024 * 1024;

export interface GenerateJobData extends GenerateQuestionsDto {
  documentId: string;
  userId: string;
}

function toDocumentDto(doc: Document & { _count?: { chunks: number } }): CourseDocumentDto {
  return {
    id: doc.id,
    courseId: doc.courseId,
    title: doc.title,
    mimeType: doc.mimeType,
    sizeBytes: doc.sizeBytes,
    status: doc.status,
    pageCount: doc.pageCount,
    chunkCount: doc._count?.chunks,
    error: doc.error,
    createdAt: doc.createdAt.toISOString(),
  };
}

/** Chuyển câu hỏi dạng phẳng do AI sinh sang options/answer chuẩn của Exam Engine. */
export function convertGeneratedQuestion(q: GeneratedQuestion) {
  const choices = q.choices.map((text, i) => ({ id: String.fromCharCode(97 + i), text }));
  const idAt = (i: number) => choices[i]?.id;
  let options: unknown = {};
  let answer: unknown;
  switch (q.type) {
    case 'SINGLE_CHOICE':
      options = { choices };
      answer = { choiceId: idAt(q.correctChoiceIndexes[0] ?? -1) };
      break;
    case 'MULTIPLE_CHOICE':
      options = { choices };
      answer = { choiceIds: q.correctChoiceIndexes.map(idAt).filter(Boolean) };
      break;
    case 'TRUE_FALSE':
      answer = { value: q.trueFalseAnswer };
      break;
    case 'SHORT_ANSWER':
      options = {};
      answer = { accepted: q.acceptedAnswers };
      break;
  }
  // Ném lỗi nếu AI trả về câu hỏi không nhất quán (vd: chỉ số đáp án vượt số lựa chọn)
  return validateQuestionPayload(q.type, options, answer);
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly courses: CoursesService,
    private readonly banks: QuestionBankService,
    private readonly storage: StorageService,
    private readonly rag: RagService,
    private readonly claude: ClaudeService,
    @InjectQueue(AI_QUEUE) private readonly queue: Queue,
  ) {}

  // ───────────── Tài liệu ─────────────

  async uploadDocument(
    user: AuthUser,
    courseId: string,
    file: Express.Multer.File,
    title?: string,
  ) {
    await this.courses.assertCanManage(courseId, user);
    if (!file) throw new BadRequestException('Thiếu file PDF (field "file")');
    if (file.size > MAX_PDF_BYTES) throw new BadRequestException('File PDF tối đa 32MB');
    if (file.buffer.subarray(0, 5).toString('latin1') !== '%PDF-') {
      throw new BadRequestException('Chỉ hỗ trợ file PDF');
    }

    const key = `documents/${courseId}/${randomUUID()}.pdf`;
    await this.storage.put(key, file.buffer, 'application/pdf');
    const doc = await this.prisma.document.create({
      data: {
        courseId,
        uploadedById: user.id,
        title: title?.trim() || file.originalname.replace(/\.pdf$/i, ''),
        fileKey: key,
        mimeType: 'application/pdf',
        sizeBytes: file.size,
      },
    });
    await this.queue.add(
      AiJob.INGEST_DOCUMENT,
      { documentId: doc.id },
      { attempts: 2, removeOnComplete: 100 },
    );
    return toDocumentDto(doc);
  }

  async listDocuments(user: AuthUser, courseId: string) {
    await this.courses.assertCanManage(courseId, user);
    const docs = await this.prisma.document.findMany({
      where: { courseId },
      include: { _count: { select: { chunks: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return docs.map(toDocumentDto);
  }

  /** Worker: PDF → text theo trang → chunk → embedding → pgvector. */
  async ingestDocument(documentId: string) {
    const doc = await this.prisma.document.update({
      where: { id: documentId },
      data: { status: 'PROCESSING', error: null },
    });
    try {
      const pdf = await this.storage.getBuffer(doc.fileKey);
      const { pages, pageCount } = await this.rag.extractPages(pdf);
      const indexed = await this.rag.indexDocument(documentId, pages);
      await this.prisma.document.update({
        where: { id: documentId },
        data: { status: 'READY', pageCount },
      });
      return { pageCount, ...indexed };
    } catch (error) {
      await this.prisma.document.update({
        where: { id: documentId },
        data: { status: 'FAILED', error: (error as Error).message.slice(0, 500) },
      });
      throw error;
    }
  }

  // ───────────── Sinh câu hỏi ─────────────

  async enqueueGeneration(user: AuthUser, documentId: string, dto: GenerateQuestionsDto) {
    const doc = await this.prisma.document.findUnique({ where: { id: documentId } });
    if (!doc) throw new NotFoundException('Không tìm thấy tài liệu');
    await this.courses.assertCanManage(doc.courseId, user);
    await this.banks.assertBankAccess(dto.bankId, user);
    if (!this.claude.enabled) {
      throw new BadRequestException('Chưa cấu hình ANTHROPIC_API_KEY trong apps/api/.env');
    }
    const data: GenerateJobData = { ...dto, documentId, userId: user.id };
    const job = await this.queue.add(AiJob.GENERATE_QUESTIONS, data, {
      attempts: 1,
      removeOnComplete: 100,
    });
    return { jobId: job.id! };
  }

  /** Worker: gửi PDF cho Claude, kiểm tra kết quả rồi lưu câu hỏi DRAFT chờ giảng viên duyệt. */
  async generateQuestions(data: GenerateJobData) {
    const doc = await this.prisma.document.findUniqueOrThrow({ where: { id: data.documentId } });
    const pdf = await this.storage.getBuffer(doc.fileKey);
    const types = (data.types?.length ? data.types : AI_QUESTION_TYPES).filter(
      (t): t is GeneratedQuestion['type'] => (AI_QUESTION_TYPES as readonly string[]).includes(t),
    );

    const generated = await this.claude.generateQuestionsFromPdf(pdf, {
      title: doc.title,
      count: data.count,
      types,
      difficulty: data.difficulty,
      instructions: data.instructions,
    });

    let skipped = 0;
    const rows: Prisma.QuestionCreateManyInput[] = [];
    for (const q of generated) {
      try {
        const { options, answer } = convertGeneratedQuestion(q);
        rows.push({
          bankId: data.bankId,
          type: q.type,
          difficulty: q.difficulty,
          status: 'DRAFT',
          source: 'AI',
          content: q.content,
          options: options as QuestionOptions as Prisma.InputJsonValue,
          answer: answer as QuestionAnswerKey as Prisma.InputJsonValue,
          explanation: q.sourcePages.length
            ? `${q.explanation} (Tài liệu "${doc.title}", trang ${q.sourcePages.join(', ')})`
            : q.explanation,
          tags: q.tags.slice(0, 5),
          sourceDocumentId: doc.id,
        });
      } catch (error) {
        skipped++;
        this.logger.warn(`Bỏ qua câu hỏi AI không hợp lệ: ${(error as Error).message}`);
      }
    }
    const created = await this.prisma.question.createMany({ data: rows });
    return { created: created.count, skipped, bankId: data.bankId };
  }

  async getJob(jobId: string): Promise<AiJobDto> {
    const job = await this.queue.getJob(jobId);
    if (!job) throw new NotFoundException('Không tìm thấy job');
    return {
      id: job.id!,
      name: job.name,
      state: await job.getState(),
      progress: job.progress as number | object,
      result: job.returnvalue ?? null,
      failedReason: job.failedReason ?? null,
    };
  }

  // ───────────── Giải thích đáp án (RAG) ─────────────

  async explain(
    user: AuthUser,
    attemptId: string,
    attemptQuestionId: string,
  ): Promise<ExplainAnswerResult> {
    const aq = await this.prisma.attemptQuestion.findUnique({
      where: { id: attemptQuestionId },
      include: {
        attempt: { include: { exam: { select: { courseId: true, showResult: true } } } },
        question: true,
      },
    });
    if (!aq || aq.attemptId !== attemptId)
      throw new NotFoundException('Không tìm thấy câu hỏi trong bài thi');
    const { attempt, question } = aq;
    if (attempt.userId !== user.id && user.role === 'STUDENT')
      throw new NotFoundException('Không tìm thấy bài thi');
    if (attempt.status === 'IN_PROGRESS')
      throw new BadRequestException('Chỉ xem giải thích sau khi nộp bài');
    if (!attempt.exam.showResult && user.role === 'STUDENT') {
      throw new BadRequestException('Đề thi này không cho xem đáp án');
    }

    if (aq.aiExplanation) {
      return {
        ...(aq.aiExplanation as unknown as Omit<ExplainAnswerResult, 'cached'>),
        cached: true,
      };
    }

    const correctAnswer = describeAnswer(question.type, question.options, question.answer);
    const studentAnswer = describeAnswer(question.type, question.options, aq.response);
    const chunks = await this.rag.search(
      attempt.exam.courseId,
      `${question.content}\n${correctAnswer}`,
      5,
    );
    const sources = chunks.map((c, i) => ({
      index: i + 1,
      documentId: c.documentId,
      title: c.title,
      page: c.page,
      snippet: c.content.slice(0, 280),
    }));

    const explanation = await this.claude.explainAnswer({
      question: question.content,
      options: describeOptions(question.type, question.options),
      correctAnswer,
      studentAnswer,
      contexts: chunks.map((c, i) => ({
        index: i + 1,
        title: c.title,
        page: c.page,
        content: c.content,
      })),
    });

    const payload = { explanation, sources };
    await this.prisma.attemptQuestion.update({
      where: { id: aq.id },
      data: { aiExplanation: payload as unknown as Prisma.InputJsonValue },
    });
    return { ...payload, cached: false };
  }
}
