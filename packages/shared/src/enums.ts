/**
 * Enum dùng chung. Giá trị trùng với enum trong Prisma schema (apps/api/prisma/schema.prisma).
 * Dùng dạng `as const` để chạy được ở mọi môi trường (Node, trình duyệt, React Native).
 */

export const Role = {
  ADMIN: 'ADMIN',
  INSTRUCTOR: 'INSTRUCTOR',
  STUDENT: 'STUDENT',
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const CourseStatus = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  ARCHIVED: 'ARCHIVED',
} as const;
export type CourseStatus = (typeof CourseStatus)[keyof typeof CourseStatus];

export const QuestionType = {
  /** Một đáp án đúng */
  SINGLE_CHOICE: 'SINGLE_CHOICE',
  /** Nhiều đáp án đúng (có chấm điểm từng phần) */
  MULTIPLE_CHOICE: 'MULTIPLE_CHOICE',
  /** Đúng / Sai */
  TRUE_FALSE: 'TRUE_FALSE',
  /** Điền vào chỗ trống / trả lời ngắn */
  SHORT_ANSWER: 'SHORT_ANSWER',
  /** Đáp án là số (có sai số cho phép) */
  NUMERIC: 'NUMERIC',
  /** Ghép cặp */
  MATCHING: 'MATCHING',
  /** Sắp xếp thứ tự */
  ORDERING: 'ORDERING',
  /** Tự luận – cần giảng viên chấm tay */
  ESSAY: 'ESSAY',
} as const;
export type QuestionType = (typeof QuestionType)[keyof typeof QuestionType];

export const Difficulty = {
  EASY: 'EASY',
  MEDIUM: 'MEDIUM',
  HARD: 'HARD',
} as const;
export type Difficulty = (typeof Difficulty)[keyof typeof Difficulty];

export const QuestionStatus = {
  /** Câu hỏi nháp (ví dụ do AI sinh ra, chờ giảng viên duyệt) */
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  ARCHIVED: 'ARCHIVED',
} as const;
export type QuestionStatus = (typeof QuestionStatus)[keyof typeof QuestionStatus];

export const QuestionSource = {
  MANUAL: 'MANUAL',
  AI: 'AI',
} as const;
export type QuestionSource = (typeof QuestionSource)[keyof typeof QuestionSource];

export const ExamStatus = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  CLOSED: 'CLOSED',
} as const;
export type ExamStatus = (typeof ExamStatus)[keyof typeof ExamStatus];

export const ExamMode = {
  /** Đề cố định: danh sách câu hỏi chọn sẵn */
  FIXED: 'FIXED',
  /** Đề ngẫu nhiên: rút câu hỏi từ ngân hàng theo quy tắc (ExamRule) */
  RANDOM: 'RANDOM',
} as const;
export type ExamMode = (typeof ExamMode)[keyof typeof ExamMode];

export const AttemptStatus = {
  IN_PROGRESS: 'IN_PROGRESS',
  /** Đã nộp nhưng còn câu tự luận chờ chấm tay */
  SUBMITTED: 'SUBMITTED',
  /** Đã chấm xong toàn bộ */
  GRADED: 'GRADED',
} as const;
export type AttemptStatus = (typeof AttemptStatus)[keyof typeof AttemptStatus];

export const DocumentStatus = {
  UPLOADED: 'UPLOADED',
  PROCESSING: 'PROCESSING',
  READY: 'READY',
  FAILED: 'FAILED',
} as const;
export type DocumentStatus = (typeof DocumentStatus)[keyof typeof DocumentStatus];
