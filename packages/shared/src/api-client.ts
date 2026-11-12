import { API_PREFIX } from './constants.js';
import type {
  AiJobDto,
  CourseDocumentDto,
  ExamAnalyticsDto,
  ExplainAnswerInput,
  ExplainAnswerResult,
  GenerateQuestionsInput,
  OverviewAnalyticsDto,
} from './types/analytics-ai.js';
import type {
  AuthResponse,
  CourseDetailDto,
  CourseDto,
  CreateCourseInput,
  CreateLessonInput,
  HealthDto,
  LessonDto,
  LoginInput,
  RegisterInput,
  UpdateCourseInput,
  UpdateLessonInput,
  UserDto,
} from './types/common.js';
import type {
  AttemptResult,
  AttemptSummary,
  AttemptView,
  CreateExamInput,
  ExamDto,
  SaveAnswersInput,
  SaveAnswersResult,
  UpdateExamInput,
} from './types/exam.js';
import type {
  CreateQuestionBankInput,
  CreateQuestionInput,
  QuestionBankDto,
  QuestionDto,
  QuestionFilter,
  UpdateQuestionInput,
} from './types/question.js';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiClientOptions {
  /** Ví dụ: http://localhost:4000 (không kèm /api) */
  baseUrl: string;
  /** Trả về JWT hiện tại (localStorage, SecureStore, ...) */
  getToken?: () => string | null | undefined | Promise<string | null | undefined>;
  /** Gọi khi API trả 401 – thường dùng để đăng xuất */
  onUnauthorized?: () => void;
  fetch?: typeof fetch;
}

type Query = Record<string, string | number | boolean | undefined | null>;

function toQuery(query?: Query): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function createApiClient(options: ApiClientOptions) {
  const fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
  const base = `${options.baseUrl.replace(/\/$/, '')}/${API_PREFIX}`;

  async function request<T>(
    method: string,
    path: string,
    body?: unknown,
    query?: Query,
  ): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    const token = await options.getToken?.();
    if (token) headers.Authorization = `Bearer ${token}`;

    let payload: BodyInit | undefined;
    if (body instanceof FormData) {
      payload = body;
    } else if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }

    const res = await fetchImpl(`${base}${path}${toQuery(query)}`, {
      method,
      headers,
      body: payload,
    });

    const text = await res.text();
    const data: unknown = text ? safeJson(text) : undefined;

    if (!res.ok) {
      if (res.status === 401) options.onUnauthorized?.();
      const message =
        (data && typeof data === 'object' && 'message' in data
          ? Array.isArray((data as { message: unknown }).message)
            ? (data as { message: string[] }).message.join(', ')
            : String((data as { message: unknown }).message)
          : res.statusText) || `HTTP ${res.status}`;
      throw new ApiError(res.status, message, data);
    }
    return data as T;
  }

  const get = <T>(path: string, query?: Query) => request<T>('GET', path, undefined, query);
  const post = <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {});
  const patch = <T>(path: string, body: unknown) => request<T>('PATCH', path, body);
  const put = <T>(path: string, body: unknown) => request<T>('PUT', path, body);
  const del = <T>(path: string) => request<T>('DELETE', path);

  return {
    request,
    health: () => get<HealthDto>('/health'),

    auth: {
      register: (input: RegisterInput) => post<AuthResponse>('/auth/register', input),
      login: (input: LoginInput) => post<AuthResponse>('/auth/login', input),
      me: () => get<UserDto>('/auth/me'),
    },

    courses: {
      list: (query?: { mine?: boolean; search?: string }) => get<CourseDto[]>('/courses', query),
      get: (id: string) => get<CourseDetailDto>(`/courses/${id}`),
      create: (input: CreateCourseInput) => post<CourseDto>('/courses', input),
      update: (id: string, input: UpdateCourseInput) => patch<CourseDto>(`/courses/${id}`, input),
      enroll: (id: string) => post<{ enrolled: true }>(`/courses/${id}/enroll`),
      addLesson: (courseId: string, input: CreateLessonInput) =>
        post<LessonDto>(`/courses/${courseId}/lessons`, input),
      updateLesson: (lessonId: string, input: UpdateLessonInput) =>
        patch<LessonDto>(`/lessons/${lessonId}`, input),
      deleteLesson: (lessonId: string) => del<{ deleted: true }>(`/lessons/${lessonId}`),
    },

    questionBanks: {
      list: (query?: { courseId?: string }) => get<QuestionBankDto[]>('/question-banks', query),
      get: (id: string) => get<QuestionBankDto>(`/question-banks/${id}`),
      create: (input: CreateQuestionBankInput) => post<QuestionBankDto>('/question-banks', input),
      questions: (bankId: string, filter?: QuestionFilter) =>
        get<QuestionDto[]>(`/question-banks/${bankId}/questions`, { ...filter }),
      addQuestion: (bankId: string, input: CreateQuestionInput) =>
        post<QuestionDto>(`/question-banks/${bankId}/questions`, input),
      updateQuestion: (questionId: string, input: UpdateQuestionInput) =>
        patch<QuestionDto>(`/questions/${questionId}`, input),
      deleteQuestion: (questionId: string) => del<{ deleted: true }>(`/questions/${questionId}`),
    },

    exams: {
      list: (query?: { courseId?: string }) => get<ExamDto[]>('/exams', query),
      get: (id: string) => get<ExamDto>(`/exams/${id}`),
      create: (input: CreateExamInput) => post<ExamDto>('/exams', input),
      update: (id: string, input: UpdateExamInput) => patch<ExamDto>(`/exams/${id}`, input),
      publish: (id: string) => post<ExamDto>(`/exams/${id}/publish`),
      /** Sinh thử một đề theo quy tắc để kiểm tra ngân hàng đủ câu hỏi */
      preview: (id: string) =>
        get<{
          total: number;
          maxScore: number;
          questions: Array<{ id: string; type: string; content: string }>;
        }>(`/exams/${id}/preview`),
    },

    attempts: {
      /** Bắt đầu (hoặc tiếp tục) lượt thi */
      start: (examId: string) => post<AttemptView>(`/exams/${examId}/attempts`),
      mine: () => get<AttemptSummary[]>('/attempts/mine'),
      get: (attemptId: string) => get<AttemptView>(`/attempts/${attemptId}`),
      saveAnswers: (attemptId: string, input: SaveAnswersInput) =>
        put<SaveAnswersResult>(`/attempts/${attemptId}/answers`, input),
      submit: (attemptId: string) => post<AttemptResult>(`/attempts/${attemptId}/submit`),
      result: (attemptId: string) => get<AttemptResult>(`/attempts/${attemptId}/result`),
    },

    analytics: {
      overview: () => get<OverviewAnalyticsDto>('/analytics/overview'),
      exam: (examId: string) => get<ExamAnalyticsDto>(`/analytics/exams/${examId}`),
    },

    ai: {
      uploadDocument: (courseId: string, file: Blob, title?: string, fileName = 'document.pdf') => {
        const form = new FormData();
        form.append('courseId', courseId);
        if (title) form.append('title', title);
        form.append('file', file, fileName);
        return request<CourseDocumentDto>('POST', '/ai/documents', form);
      },
      documents: (courseId: string) => get<CourseDocumentDto[]>('/ai/documents', { courseId }),
      generateQuestions: (documentId: string, input: GenerateQuestionsInput) =>
        post<{ jobId: string }>(`/ai/documents/${documentId}/generate-questions`, input),
      job: (jobId: string) => get<AiJobDto>(`/ai/jobs/${jobId}`),
      explain: (input: ExplainAnswerInput) => post<ExplainAnswerResult>('/ai/explain', input),
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
