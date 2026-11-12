/** Hàng đợi tự nộp bài khi hết giờ (delayed job theo từng lượt thi). */
export const EXAM_TIMER_QUEUE = 'exam-timer';
/** Hàng đợi tác vụ AI: xử lý PDF (RAG) và sinh câu hỏi. */
export const AI_QUEUE = 'ai';

export const ExamTimerJob = {
  EXPIRE: 'expire-attempt',
  SWEEP: 'sweep-expired',
} as const;

export const AiJob = {
  INGEST_DOCUMENT: 'ingest-document',
  GENERATE_QUESTIONS: 'generate-questions',
} as const;
