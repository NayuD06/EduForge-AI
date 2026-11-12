import type { CourseStatus, Role } from '../enums.js';

export interface UserDto {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  createdAt: string;
}

export interface AuthResponse {
  accessToken: string;
  user: UserDto;
}

export interface RegisterInput {
  email: string;
  password: string;
  fullName: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface LessonDto {
  id: string;
  courseId: string;
  title: string;
  content: string;
  videoUrl: string | null;
  order: number;
  durationMin: number | null;
  createdAt: string;
}

export interface CourseDto {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  coverUrl: string | null;
  status: CourseStatus;
  instructor: Pick<UserDto, 'id' | 'fullName'>;
  lessonCount?: number;
  examCount?: number;
  createdAt: string;
}

export interface CourseDetailDto extends CourseDto {
  lessons: LessonDto[];
  exams: Array<{ id: string; title: string; durationSec: number; status: string }>;
  isEnrolled: boolean;
}

export interface CreateCourseInput {
  title: string;
  description?: string;
  coverUrl?: string;
  status?: CourseStatus;
}

export type UpdateCourseInput = Partial<CreateCourseInput>;

export interface CreateLessonInput {
  title: string;
  content?: string;
  videoUrl?: string;
  order?: number;
  durationMin?: number;
}

export type UpdateLessonInput = Partial<CreateLessonInput>;

export interface HealthDto {
  status: 'ok' | 'degraded';
  uptimeSec: number;
  services: Record<string, 'up' | 'down'>;
}
