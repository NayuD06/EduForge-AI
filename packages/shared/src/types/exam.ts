import type { AttemptStatus, Difficulty, ExamMode, ExamStatus, QuestionType } from '../enums.js';
import type { QuestionAnswerKey, QuestionOptions, QuestionResponse } from './question.js';

/** Quy tắc rút câu hỏi ngẫu nhiên từ ngân hàng cho đề RANDOM. */
export interface ExamRuleDto {
  id?: string;
  bankId: string;
  count: number;
  type?: QuestionType | null;
  difficulty?: Difficulty | null;
  /** Câu hỏi phải có ít nhất một tag trong danh sách (để trống = không lọc) */
  tags?: string[];
  /** Ghi đè điểm mỗi câu (để trống = dùng điểm của câu hỏi) */
  pointsPerQuestion?: number | null;
}

export interface ExamDto {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  mode: ExamMode;
  status: ExamStatus;
  durationSec: number;
  /** % điểm tối thiểu để đạt (0-100) */
  passingPercent: number;
  /** 0 = không giới hạn */
  maxAttempts: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  showResult: boolean;
  startAt: string | null;
  endAt: string | null;
  rules: ExamRuleDto[];
  questionIds: string[];
  createdAt: string;
}

export interface CreateExamInput {
  courseId: string;
  title: string;
  description?: string;
  mode: ExamMode;
  durationSec: number;
  passingPercent?: number;
  maxAttempts?: number;
  shuffleQuestions?: boolean;
  shuffleOptions?: boolean;
  showResult?: boolean;
  startAt?: string;
  endAt?: string;
  /** Bắt buộc khi mode = RANDOM */
  rules?: ExamRuleDto[];
  /** Bắt buộc khi mode = FIXED */
  questionIds?: string[];
}

export type UpdateExamInput = Partial<Omit<CreateExamInput, 'courseId'>>;

/** Câu hỏi trong một lượt thi – đã ẩn đáp án, options đã được xáo trộn (nếu bật). */
export interface AttemptQuestionView<T extends QuestionType = QuestionType> {
  /** id của AttemptQuestion (dùng khi lưu câu trả lời) */
  id: string;
  questionId: string;
  order: number;
  type: T;
  content: string;
  options: QuestionOptions<T>;
  points: number;
  response: QuestionResponse<T> | null;
  flagged: boolean;
}

export interface AttemptView {
  id: string;
  examId: string;
  examTitle: string;
  status: AttemptStatus;
  startedAt: string;
  /** Thời điểm hết giờ theo đồng hồ máy chủ */
  expiresAt: string;
  submittedAt: string | null;
  /** Đồng hồ máy chủ lúc trả response – client dùng để bù lệch giờ */
  serverNow: string;
  questions: AttemptQuestionView[];
}

export interface SaveAnswerItem {
  attemptQuestionId: string;
  response: unknown | null;
  flagged?: boolean;
}

export interface SaveAnswersInput {
  answers: SaveAnswerItem[];
}

export interface SaveAnswersResult {
  savedAt: string;
  saved: number;
  expiresAt: string;
}

export interface AttemptResultQuestion<
  T extends QuestionType = QuestionType,
> extends AttemptQuestionView<T> {
  isCorrect: boolean | null;
  score: number | null;
  needsManualGrading: boolean;
  correctAnswer: QuestionAnswerKey<T> | null;
  explanation: string | null;
}

export interface AttemptResult {
  id: string;
  examId: string;
  examTitle: string;
  status: AttemptStatus;
  autoSubmitted: boolean;
  startedAt: string;
  submittedAt: string | null;
  score: number | null;
  maxScore: number;
  percent: number | null;
  passed: boolean | null;
  /** null khi đề thi cấu hình không hiển thị kết quả chi tiết */
  questions: AttemptResultQuestion[] | null;
}

export interface AttemptSummary {
  id: string;
  examId: string;
  examTitle: string;
  status: AttemptStatus;
  startedAt: string;
  submittedAt: string | null;
  percent: number | null;
  passed: boolean | null;
}
