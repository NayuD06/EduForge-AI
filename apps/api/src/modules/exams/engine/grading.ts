import type { QuestionType } from '@eduforge/shared';
import { round2 } from '../../../common/utils.js';

export interface GradeOutcome {
  /** null = chờ chấm tay (tự luận) */
  score: number | null;
  isCorrect: boolean | null;
  needsManualGrading: boolean;
}

type AnyRecord = Record<string, any>;

const normalizeText = (value: string, caseSensitive: boolean) => {
  const text = value.normalize('NFC').trim().replace(/\s+/g, ' ');
  return caseSensitive ? text : text.toLocaleLowerCase('vi');
};

const ratioOutcome = (ratio: number, points: number, isCorrect: boolean): GradeOutcome => ({
  score: round2(points * Math.max(0, Math.min(1, ratio))),
  isCorrect,
  needsManualGrading: false,
});

const WRONG: GradeOutcome = { score: 0, isCorrect: false, needsManualGrading: false };

/**
 * Chấm một câu trả lời. Hàm thuần (không I/O) để dễ test.
 *  - MULTIPLE_CHOICE: điểm từng phần = (số đúng đã chọn − số sai đã chọn) / tổng số đáp án đúng
 *  - MATCHING / ORDERING: điểm theo tỉ lệ cặp / vị trí đúng
 *  - ESSAY: chuyển sang chấm tay
 */
export function gradeResponse(
  type: QuestionType,
  answerKey: unknown,
  response: unknown,
  points: number,
): GradeOutcome {
  const key = (answerKey ?? {}) as AnyRecord;
  const res = response as AnyRecord | null | undefined;

  if (type === 'ESSAY') {
    const text = typeof res?.text === 'string' ? res.text.trim() : '';
    return text
      ? { score: null, isCorrect: null, needsManualGrading: true }
      : { score: 0, isCorrect: false, needsManualGrading: false };
  }
  if (res === null || res === undefined) return WRONG;

  switch (type) {
    case 'SINGLE_CHOICE': {
      const ok = res.choiceId === key.choiceId;
      return ratioOutcome(ok ? 1 : 0, points, ok);
    }
    case 'TRUE_FALSE': {
      const ok = res.value === key.value;
      return ratioOutcome(ok ? 1 : 0, points, ok);
    }
    case 'MULTIPLE_CHOICE': {
      const correct = new Set<string>(key.choiceIds ?? []);
      const chosen = new Set<string>(res.choiceIds ?? []);
      if (correct.size === 0) return WRONG;
      let hit = 0;
      let miss = 0;
      for (const id of chosen) {
        if (correct.has(id)) hit++;
        else miss++;
      }
      const exact = hit === correct.size && miss === 0;
      return ratioOutcome((hit - miss) / correct.size, points, exact);
    }
    case 'SHORT_ANSWER': {
      const caseSensitive = !!key.caseSensitive;
      const given = normalizeText(String(res.text ?? ''), caseSensitive);
      const ok =
        given.length > 0 &&
        (key.accepted ?? []).some((a: string) => normalizeText(a, caseSensitive) === given);
      return ratioOutcome(ok ? 1 : 0, points, ok);
    }
    case 'NUMERIC': {
      const value = Number(res.value);
      const tolerance = Number(key.tolerance ?? 0);
      const ok = Number.isFinite(value) && Math.abs(value - Number(key.value)) <= tolerance + 1e-9;
      return ratioOutcome(ok ? 1 : 0, points, ok);
    }
    case 'MATCHING': {
      const pairs = (key.pairs ?? {}) as Record<string, string>;
      const given = (res.pairs ?? {}) as Record<string, string>;
      const total = Object.keys(pairs).length;
      if (total === 0) return WRONG;
      const hit = Object.entries(pairs).filter(([l, r]) => given[l] === r).length;
      return ratioOutcome(hit / total, points, hit === total);
    }
    case 'ORDERING': {
      const order = (key.order ?? []) as string[];
      const given = (res.order ?? []) as string[];
      if (order.length === 0) return WRONG;
      const hit = order.filter((id, i) => given[i] === id).length;
      return ratioOutcome(hit / order.length, points, hit === order.length);
    }
    default:
      return WRONG;
  }
}

export interface AttemptTotals {
  score: number;
  maxScore: number;
  percent: number;
  pendingManual: number;
}

export function summarize(
  items: Array<{ points: number; outcome: Pick<GradeOutcome, 'score' | 'needsManualGrading'> }>,
): AttemptTotals {
  const maxScore = round2(items.reduce((sum, i) => sum + i.points, 0));
  const score = round2(items.reduce((sum, i) => sum + (i.outcome.score ?? 0), 0));
  return {
    score,
    maxScore,
    percent: maxScore > 0 ? round2((score / maxScore) * 100) : 0,
    pendingManual: items.filter((i) => i.outcome.needsManualGrading).length,
  };
}
