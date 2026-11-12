import type { Difficulty, QuestionSource, QuestionStatus, QuestionType } from '../enums.js';

export interface ChoiceOption {
  id: string;
  text: string;
}

/**
 * Với mỗi dạng câu hỏi:
 *  - `options`: dữ liệu hiển thị cho thí sinh (lưu ở cột Question.options)
 *  - `answer`: đáp án/khóa chấm (Question.answer) – KHÔNG bao giờ gửi cho thí sinh khi đang thi
 *  - `response`: câu trả lời của thí sinh (AttemptQuestion.response)
 */
export interface QuestionPayloadMap {
  SINGLE_CHOICE: {
    options: { choices: ChoiceOption[] };
    answer: { choiceId: string };
    response: { choiceId: string };
  };
  MULTIPLE_CHOICE: {
    options: { choices: ChoiceOption[] };
    answer: { choiceIds: string[] };
    response: { choiceIds: string[] };
  };
  TRUE_FALSE: {
    options: Record<string, never>;
    answer: { value: boolean };
    response: { value: boolean };
  };
  SHORT_ANSWER: {
    options: { placeholder?: string };
    answer: { accepted: string[]; caseSensitive?: boolean };
    response: { text: string };
  };
  NUMERIC: {
    options: { unit?: string };
    answer: { value: number; tolerance?: number };
    response: { value: number };
  };
  MATCHING: {
    options: { left: ChoiceOption[]; right: ChoiceOption[] };
    /** leftId -> rightId */
    answer: { pairs: Record<string, string> };
    response: { pairs: Record<string, string> };
  };
  ORDERING: {
    options: { items: ChoiceOption[] };
    answer: { order: string[] };
    response: { order: string[] };
  };
  ESSAY: {
    options: { minWords?: number; maxWords?: number };
    answer: { rubric?: string };
    response: { text: string };
  };
}

export type QuestionOptions<T extends QuestionType = QuestionType> =
  QuestionPayloadMap[T]['options'];
export type QuestionAnswerKey<T extends QuestionType = QuestionType> =
  QuestionPayloadMap[T]['answer'];
export type QuestionResponse<T extends QuestionType = QuestionType> =
  QuestionPayloadMap[T]['response'];

export interface QuestionBankDto {
  id: string;
  name: string;
  description: string | null;
  courseId: string | null;
  ownerId: string;
  questionCount?: number;
  createdAt: string;
}

export interface QuestionDto<T extends QuestionType = QuestionType> {
  id: string;
  bankId: string;
  type: T;
  difficulty: Difficulty;
  status: QuestionStatus;
  source: QuestionSource;
  content: string;
  options: QuestionOptions<T>;
  answer: QuestionAnswerKey<T>;
  explanation: string | null;
  tags: string[];
  points: number;
  sourceDocumentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateQuestionBankInput {
  name: string;
  description?: string;
  courseId?: string;
}

export interface CreateQuestionInput<T extends QuestionType = QuestionType> {
  type: T;
  difficulty?: Difficulty;
  status?: QuestionStatus;
  content: string;
  options: QuestionOptions<T>;
  answer: QuestionAnswerKey<T>;
  explanation?: string;
  tags?: string[];
  points?: number;
}

export type UpdateQuestionInput = Partial<CreateQuestionInput>;

export interface QuestionFilter {
  type?: QuestionType;
  difficulty?: Difficulty;
  status?: QuestionStatus;
  tag?: string;
  search?: string;
}
