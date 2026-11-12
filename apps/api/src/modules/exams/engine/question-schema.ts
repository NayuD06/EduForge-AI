import type {
  QuestionAnswerKey,
  QuestionOptions,
  QuestionResponse,
  QuestionType,
} from '@eduforge/shared';
import { z } from 'zod';

/**
 * Lược đồ (zod) cho `options` / `answer` / `response` của từng dạng câu hỏi.
 * Dùng khi: tạo/sửa câu hỏi, lưu tiến trình bài thi, kiểm tra câu hỏi do AI sinh.
 */
const choice = z.object({ id: z.string().min(1), text: z.string().min(1) });
const choices = z.array(choice).min(2, 'Cần ít nhất 2 lựa chọn');

export const questionSchemas = {
  SINGLE_CHOICE: {
    options: z.object({ choices }),
    answer: z.object({ choiceId: z.string().min(1) }),
    response: z.object({ choiceId: z.string().min(1) }),
  },
  MULTIPLE_CHOICE: {
    options: z.object({ choices }),
    answer: z.object({ choiceIds: z.array(z.string().min(1)).min(1) }),
    response: z.object({ choiceIds: z.array(z.string().min(1)) }),
  },
  TRUE_FALSE: {
    options: z.object({}).strict(),
    answer: z.object({ value: z.boolean() }),
    response: z.object({ value: z.boolean() }),
  },
  SHORT_ANSWER: {
    options: z.object({ placeholder: z.string().optional() }),
    answer: z.object({
      accepted: z.array(z.string().min(1)).min(1),
      caseSensitive: z.boolean().optional(),
    }),
    response: z.object({ text: z.string().max(2000) }),
  },
  NUMERIC: {
    options: z.object({ unit: z.string().optional() }),
    answer: z.object({ value: z.number(), tolerance: z.number().min(0).optional() }),
    response: z.object({ value: z.number() }),
  },
  MATCHING: {
    options: z.object({ left: choices, right: choices }),
    answer: z.object({ pairs: z.record(z.string(), z.string()) }),
    response: z.object({ pairs: z.record(z.string(), z.string()) }),
  },
  ORDERING: {
    options: z.object({ items: choices }),
    answer: z.object({ order: z.array(z.string().min(1)).min(2) }),
    response: z.object({ order: z.array(z.string().min(1)) }),
  },
  ESSAY: {
    options: z.object({
      minWords: z.number().int().min(0).optional(),
      maxWords: z.number().int().min(1).optional(),
    }),
    answer: z.object({ rubric: z.string().optional() }),
    response: z.object({ text: z.string().max(50_000) }),
  },
} as const satisfies Record<
  QuestionType,
  { options: z.ZodType; answer: z.ZodType; response: z.ZodType }
>;

export class QuestionPayloadError extends Error {}

/** Kiểm tra options + answer hợp lệ và nhất quán với nhau. Ném QuestionPayloadError nếu sai. */
export function validateQuestionPayload<T extends QuestionType>(
  type: T,
  rawOptions: unknown,
  rawAnswer: unknown,
): { options: QuestionOptions<T>; answer: QuestionAnswerKey<T> } {
  const schema = questionSchemas[type];
  const options = schema.options.safeParse(rawOptions ?? {});
  if (!options.success)
    throw new QuestionPayloadError(`options không hợp lệ: ${options.error.message}`);
  const answer = schema.answer.safeParse(rawAnswer);
  if (!answer.success)
    throw new QuestionPayloadError(`answer không hợp lệ: ${answer.error.message}`);

  const o = options.data as Record<string, unknown>;
  const a = answer.data as Record<string, unknown>;
  const ids = (list: unknown) => new Set((list as { id: string }[]).map((c) => c.id));

  switch (type) {
    case 'SINGLE_CHOICE':
      if (!ids(o.choices).has(a.choiceId as string))
        throw new QuestionPayloadError('choiceId của đáp án không có trong danh sách lựa chọn');
      break;
    case 'MULTIPLE_CHOICE': {
      const set = ids(o.choices);
      if (!(a.choiceIds as string[]).every((id) => set.has(id)))
        throw new QuestionPayloadError('choiceIds của đáp án không có trong danh sách lựa chọn');
      break;
    }
    case 'MATCHING': {
      const left = ids(o.left);
      const right = ids(o.right);
      const pairs = a.pairs as Record<string, string>;
      if (Object.keys(pairs).length !== left.size)
        throw new QuestionPayloadError('Mỗi mục bên trái cần đúng một cặp ghép');
      for (const [l, r] of Object.entries(pairs)) {
        if (!left.has(l) || !right.has(r))
          throw new QuestionPayloadError(`Cặp ghép không hợp lệ: ${l} -> ${r}`);
      }
      break;
    }
    case 'ORDERING': {
      const set = ids(o.items);
      const order = a.order as string[];
      if (order.length !== set.size || !order.every((id) => set.has(id)))
        throw new QuestionPayloadError('Thứ tự đúng phải chứa đủ và chỉ các mục đã cho');
      break;
    }
  }
  return {
    options: options.data as QuestionOptions<T>,
    answer: answer.data as QuestionAnswerKey<T>,
  };
}

/** Kiểm tra câu trả lời của thí sinh (null = xóa câu trả lời). */
export function parseResponse<T extends QuestionType>(
  type: T,
  raw: unknown,
): QuestionResponse<T> | null {
  if (raw === null || raw === undefined) return null;
  const parsed = questionSchemas[type].response.safeParse(raw);
  if (!parsed.success) throw new QuestionPayloadError(`Câu trả lời không hợp lệ cho dạng ${type}`);
  return parsed.data as QuestionResponse<T>;
}
