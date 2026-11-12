import type { Difficulty, QuestionType } from '@eduforge/shared';
import { createRng, type Rng, sample, shuffle } from './random.js';

export interface CandidateQuestion {
  id: string;
  bankId: string;
  type: QuestionType;
  difficulty: Difficulty;
  tags: string[];
  points: number;
}

export interface GenerationRule {
  bankId: string;
  count: number;
  type?: QuestionType | null;
  difficulty?: Difficulty | null;
  tags?: string[];
  pointsPerQuestion?: number | null;
}

export interface GeneratedItem {
  questionId: string;
  order: number;
  points: number;
}

export class InsufficientQuestionsError extends Error {
  constructor(
    public readonly ruleIndex: number,
    public readonly required: number,
    public readonly available: number,
  ) {
    super(
      `Quy tắc #${ruleIndex + 1} cần ${required} câu nhưng ngân hàng chỉ có ${available} câu phù hợp`,
    );
  }
}

export function matchesRule(question: CandidateQuestion, rule: GenerationRule): boolean {
  if (question.bankId !== rule.bankId) return false;
  if (rule.type && question.type !== rule.type) return false;
  if (rule.difficulty && question.difficulty !== rule.difficulty) return false;
  if (rule.tags?.length && !rule.tags.some((t) => question.tags.includes(t))) return false;
  return true;
}

/**
 * Sinh đề ngẫu nhiên theo danh sách quy tắc.
 * - Mỗi câu chỉ xuất hiện một lần dù khớp nhiều quy tắc.
 * - Cùng seed + cùng ngân hàng ⇒ cùng một đề (tái lập được).
 */
export function generateRandomExam(
  rules: GenerationRule[],
  pool: CandidateQuestion[],
  seed: number,
  options: { shuffleQuestions: boolean },
): GeneratedItem[] {
  const rng = createRng(seed);
  const used = new Set<string>();
  const picked: Array<{ questionId: string; points: number }> = [];

  rules.forEach((rule, index) => {
    const candidates = pool.filter((q) => !used.has(q.id) && matchesRule(q, rule));
    if (candidates.length < rule.count) {
      throw new InsufficientQuestionsError(index, rule.count, candidates.length);
    }
    for (const q of sample(candidates, rule.count, rng)) {
      used.add(q.id);
      picked.push({ questionId: q.id, points: rule.pointsPerQuestion ?? q.points });
    }
  });

  const ordered = options.shuffleQuestions ? shuffle(picked, rng) : picked;
  return ordered.map((item, order) => ({ ...item, order }));
}

/** Đề cố định: giữ thứ tự giảng viên chọn, hoặc xáo nếu bật shuffleQuestions. */
export function buildFixedExam(
  items: Array<{ questionId: string; order: number; points: number }>,
  seed: number,
  options: { shuffleQuestions: boolean },
): GeneratedItem[] {
  const sorted = [...items].sort((a, b) => a.order - b.order);
  const ordered = options.shuffleQuestions ? shuffle(sorted, createRng(seed)) : sorted;
  return ordered.map((item, order) => ({ ...item, order }));
}

export type OptionOrder = Partial<Record<'choices' | 'right' | 'items', string[]>>;

/**
 * Xáo trộn thứ tự lựa chọn của một câu hỏi. Trả về thứ tự id để lưu vào AttemptQuestion.optionOrder.
 * ORDERING luôn được xáo (nếu không, thứ tự hiển thị chính là đáp án).
 */
export function shuffleOptionOrder(
  type: QuestionType,
  options: unknown,
  rng: Rng,
  shuffleEnabled: boolean,
): OptionOrder | null {
  const o = (options ?? {}) as Record<string, Array<{ id: string }> | undefined>;
  const ids = (list?: Array<{ id: string }>) => (list ?? []).map((c) => c.id);

  switch (type) {
    case 'SINGLE_CHOICE':
    case 'MULTIPLE_CHOICE':
      return shuffleEnabled ? { choices: shuffle(ids(o.choices), rng) } : null;
    case 'MATCHING':
      return shuffleEnabled ? { right: shuffle(ids(o.right), rng) } : null;
    case 'ORDERING': {
      const original = ids(o.items);
      let shuffled = shuffle(original, rng);
      for (let i = 0; i < 5 && original.length > 1 && shuffled.join() === original.join(); i++) {
        shuffled = shuffle(original, rng);
      }
      return { items: shuffled };
    }
    default:
      return null;
  }
}

/** Áp thứ tự đã lưu lên options gốc để hiển thị cho thí sinh. */
export function applyOptionOrder<T>(options: T, order: OptionOrder | null | undefined): T {
  if (!order || !options || typeof options !== 'object') return options;
  const result: Record<string, unknown> = { ...(options as Record<string, unknown>) };
  for (const [field, ids] of Object.entries(order)) {
    const list = result[field];
    if (!Array.isArray(list) || !ids) continue;
    const byId = new Map(list.map((item: { id: string }) => [item.id, item]));
    result[field] = ids.map((id) => byId.get(id)).filter(Boolean);
  }
  return result as T;
}
