import type { Difficulty, DocumentStatus, QuestionType } from '../enums.js';

export interface ExamAnalyticsDto {
  examId: string;
  examTitle: string;
  attemptCount: number;
  submittedCount: number;
  averagePercent: number | null;
  passRate: number | null;
  /** Phổ điểm theo khoảng 10% (0-10, 10-20, ...) */
  distribution: Array<{ bucket: string; count: number }>;
  /** Tỉ lệ trả lời đúng từng câu – phát hiện câu quá khó/quá dễ */
  questions: Array<{
    questionId: string;
    content: string;
    type: QuestionType;
    difficulty: Difficulty;
    answered: number;
    correctRate: number | null;
  }>;
}

export interface OverviewAnalyticsDto {
  courses: number;
  students: number;
  questions: number;
  exams: number;
  attempts: number;
  averagePercent: number | null;
}

export interface CourseDocumentDto {
  id: string;
  courseId: string;
  title: string;
  mimeType: string;
  sizeBytes: number;
  status: DocumentStatus;
  pageCount: number | null;
  chunkCount?: number;
  error: string | null;
  createdAt: string;
}

export interface GenerateQuestionsInput {
  bankId: string;
  count: number;
  types?: QuestionType[];
  difficulty?: Difficulty;
  /** Gợi ý thêm cho AI (chương/chủ đề cần tập trung) */
  instructions?: string;
}

export interface AiJobDto {
  id: string;
  name: string;
  state: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed' | 'unknown' | string;
  progress: number | object;
  result: unknown;
  failedReason: string | null;
}

export interface ExplainAnswerInput {
  attemptId: string;
  attemptQuestionId: string;
}

export interface ExplainAnswerResult {
  explanation: string;
  sources: Array<{
    index: number;
    documentId: string;
    title: string;
    page: number | null;
    snippet: string;
  }>;
  cached: boolean;
}
