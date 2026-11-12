import type { QuestionType } from '@eduforge/shared';

type AnyRecord = Record<string, any>;

/** Diễn đạt đáp án / câu trả lời thành văn bản để đưa vào prompt cho AI giải thích. */
export function describeAnswer(type: QuestionType, options: unknown, value: unknown): string {
  if (value === null || value === undefined) return '(không trả lời)';
  const o = (options ?? {}) as AnyRecord;
  const v = value as AnyRecord;
  const label = (list: Array<{ id: string; text: string }> | undefined, id: string) =>
    list?.find((c) => c.id === id)?.text ?? id;

  switch (type) {
    case 'SINGLE_CHOICE':
      return label(o.choices, v.choiceId);
    case 'MULTIPLE_CHOICE':
      return (
        (v.choiceIds ?? []).map((id: string) => label(o.choices, id)).join('; ') || '(không chọn)'
      );
    case 'TRUE_FALSE':
      return v.value ? 'Đúng' : 'Sai';
    case 'SHORT_ANSWER':
      return v.accepted ? (v.accepted as string[]).join(' / ') : String(v.text ?? '');
    case 'NUMERIC':
      return `${v.value}${v.tolerance ? ` (±${v.tolerance})` : ''}${o.unit ? ` ${o.unit}` : ''}`;
    case 'MATCHING':
      return Object.entries((v.pairs ?? {}) as Record<string, string>)
        .map(([l, r]) => `${label(o.left, l)} → ${label(o.right, r)}`)
        .join('; ');
    case 'ORDERING':
      return (v.order ?? []).map((id: string) => label(o.items, id)).join(' → ');
    case 'ESSAY':
      return String(v.text ?? v.rubric ?? '');
    default:
      return JSON.stringify(value);
  }
}

/** Liệt kê lựa chọn của câu hỏi (dạng trắc nghiệm) để AI có đủ ngữ cảnh. */
export function describeOptions(type: QuestionType, options: unknown): string {
  const o = (options ?? {}) as AnyRecord;
  const list = (items?: Array<{ text: string }>) =>
    (items ?? []).map((c, i) => `${String.fromCharCode(65 + i)}. ${c.text}`).join('\n');
  switch (type) {
    case 'SINGLE_CHOICE':
    case 'MULTIPLE_CHOICE':
      return list(o.choices);
    case 'MATCHING':
      return `Cột trái:\n${list(o.left)}\nCột phải:\n${list(o.right)}`;
    case 'ORDERING':
      return list(o.items);
    default:
      return '';
  }
}
