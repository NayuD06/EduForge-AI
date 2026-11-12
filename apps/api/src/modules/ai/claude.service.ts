import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import type { Env } from '../../config/env.js';
import { EXPLAIN_SYSTEM_PROMPT, QUESTION_GEN_SYSTEM_PROMPT } from './prompts.js';

/** Câu hỏi AI trả về (dạng phẳng, dễ ràng buộc bằng structured outputs) – được chuyển đổi & kiểm tra lại trước khi lưu. */
export const GeneratedQuestionSchema = z.object({
  type: z.enum(['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE', 'SHORT_ANSWER']),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']),
  content: z.string().describe('Nội dung câu hỏi'),
  choices: z
    .array(z.string())
    .describe('Các lựa chọn (chỉ cho SINGLE_CHOICE / MULTIPLE_CHOICE, ngược lại để [])'),
  correctChoiceIndexes: z
    .array(z.number().int())
    .describe('Chỉ số (từ 0) của lựa chọn đúng; SINGLE_CHOICE có đúng 1 phần tử'),
  trueFalseAnswer: z.boolean().nullable().describe('Đáp án cho TRUE_FALSE, ngược lại null'),
  acceptedAnswers: z
    .array(z.string())
    .describe('Các đáp án chấp nhận cho SHORT_ANSWER, ngược lại []'),
  explanation: z.string().describe('Giải thích ngắn vì sao đáp án đúng, bám theo tài liệu'),
  sourcePages: z
    .array(z.number().int())
    .describe('Trang trong tài liệu chứa kiến thức của câu hỏi'),
  tags: z.array(z.string()).describe('1-3 tag chủ đề ngắn, viết thường, không dấu cách'),
});
export type GeneratedQuestion = z.infer<typeof GeneratedQuestionSchema>;

const GeneratedQuestionsSchema = z.object({ questions: z.array(GeneratedQuestionSchema) });

export interface GenerateParams {
  title: string;
  count: number;
  types: GeneratedQuestion['type'][];
  difficulty?: GeneratedQuestion['difficulty'];
  instructions?: string;
}

export interface ExplainParams {
  question: string;
  options: string;
  correctAnswer: string;
  studentAnswer: string;
  contexts: Array<{ index: number; title: string; page: number | null; content: string }>;
}

// Server-side fallback: nếu model chính từ chối (refusal), API tự chạy lại trên model dự phòng được khuyến nghị.
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

@Injectable()
export class ClaudeService {
  private readonly logger = new Logger(ClaudeService.name);
  private readonly client: Anthropic | null;
  readonly model: string;

  constructor(config: ConfigService<Env, true>) {
    const apiKey = config.get('ANTHROPIC_API_KEY', { infer: true });
    this.model = config.get('CLAUDE_MODEL', { infer: true });
    this.client = apiKey ? new Anthropic({ apiKey }) : null;
    if (!this.client)
      this.logger.warn('Chưa có ANTHROPIC_API_KEY – các tính năng AI sẽ trả lỗi 503.');
  }

  get enabled() {
    return this.client !== null;
  }

  private requireClient(): Anthropic {
    if (!this.client) {
      throw new ServiceUnavailableException('Chưa cấu hình ANTHROPIC_API_KEY trong apps/api/.env');
    }
    return this.client;
  }

  /** Đọc trực tiếp file PDF (Claude hỗ trợ PDF gốc: chữ, bảng, hình) và sinh câu hỏi có cấu trúc. */
  async generateQuestionsFromPdf(
    pdf: Buffer,
    params: GenerateParams,
  ): Promise<GeneratedQuestion[]> {
    const client = this.requireClient();
    const response = await client.beta.messages.parse({
      model: this.model,
      max_tokens: 16000,
      betas: [FALLBACK_BETA],
      fallbacks: 'default',
      output_config: { effort: 'high', format: betaZodOutputFormat(GeneratedQuestionsSchema) },
      system: QUESTION_GEN_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: pdf.toString('base64'),
              },
              title: params.title,
            },
            {
              type: 'text',
              text: [
                `Hãy tạo đúng ${params.count} câu hỏi từ tài liệu trên.`,
                `Dạng câu hỏi được phép: ${params.types.join(', ')}.`,
                params.difficulty
                  ? `Độ khó: ${params.difficulty}.`
                  : 'Phân bổ độ khó hợp lý (EASY/MEDIUM/HARD).',
                params.instructions ? `Yêu cầu thêm của giảng viên: ${params.instructions}` : '',
              ]
                .filter(Boolean)
                .join('\n'),
            },
          ],
        },
      ],
    });

    if (response.stop_reason === 'refusal') {
      throw new ServiceUnavailableException('AI từ chối xử lý tài liệu này');
    }
    if (response.stop_reason === 'max_tokens') {
      this.logger.warn('Phản hồi bị cắt do max_tokens – hãy giảm số câu hỏi mỗi lần sinh');
    }
    if (!response.parsed_output)
      throw new ServiceUnavailableException('AI trả về dữ liệu không đúng định dạng');
    return response.parsed_output.questions;
  }

  /** Giải thích đáp án dựa trên các đoạn tài liệu khóa học tìm được (RAG). */
  async explainAnswer(params: ExplainParams): Promise<string> {
    const client = this.requireClient();
    const context = params.contexts.length
      ? params.contexts
          .map(
            (c) =>
              `<source index="${c.index}" title="${c.title}"${c.page ? ` page="${c.page}"` : ''}>\n${c.content}\n</source>`,
          )
          .join('\n')
      : '(Không tìm thấy đoạn tài liệu liên quan)';

    const response = await client.beta.messages.create({
      model: this.model,
      max_tokens: 16000,
      betas: [FALLBACK_BETA],
      fallbacks: 'default',
      output_config: { effort: 'medium' },
      system: EXPLAIN_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            `<course_material>\n${context}\n</course_material>`,
            `<question>\n${params.question}\n${params.options}\n</question>`,
            `<correct_answer>${params.correctAnswer}</correct_answer>`,
            `<student_answer>${params.studentAnswer}</student_answer>`,
            'Hãy giải thích cho học viên.',
          ].join('\n\n'),
        },
      ],
    });

    if (response.stop_reason === 'refusal') {
      throw new ServiceUnavailableException('AI từ chối giải thích câu hỏi này');
    }
    const text = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('')
      .trim();
    if (!text) throw new ServiceUnavailableException('AI không trả về nội dung');
    return text;
  }
}
