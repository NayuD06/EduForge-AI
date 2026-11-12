import type { CourseDetailDto, CourseDto, LessonDto } from '@eduforge/shared';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { type AuthUser, isStaff } from '../../common/auth.js';
import { slugify } from '../../common/utils.js';
import type { Lesson, Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type {
  CreateCourseDto,
  CreateLessonDto,
  UpdateCourseDto,
  UpdateLessonDto,
} from './courses.dto.js';

const courseInclude = {
  instructor: { select: { id: true, fullName: true } },
  _count: { select: { lessons: true, exams: true } },
} satisfies Prisma.CourseInclude;

type CourseWithMeta = Prisma.CourseGetPayload<{ include: typeof courseInclude }>;

function toCourseDto(course: CourseWithMeta): CourseDto {
  return {
    id: course.id,
    title: course.title,
    slug: course.slug,
    description: course.description,
    coverUrl: course.coverUrl,
    status: course.status,
    instructor: course.instructor,
    lessonCount: course._count.lessons,
    examCount: course._count.exams,
    createdAt: course.createdAt.toISOString(),
  };
}

export function toLessonDto(lesson: Lesson): LessonDto {
  return {
    id: lesson.id,
    courseId: lesson.courseId,
    title: lesson.title,
    content: lesson.content,
    videoUrl: lesson.videoUrl,
    order: lesson.order,
    durationMin: lesson.durationMin,
    createdAt: lesson.createdAt.toISOString(),
  };
}

@Injectable()
export class CoursesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: AuthUser | undefined, query: { mine?: boolean; search?: string }) {
    const where: Prisma.CourseWhereInput = {};
    if (query.mine && user) {
      // Giảng viên: khóa mình dạy; học viên: khóa đã ghi danh
      if (isStaff(user)) where.instructorId = user.role === 'ADMIN' ? undefined : user.id;
      else where.enrollments = { some: { userId: user.id } };
    } else if (!isStaff(user)) {
      where.status = 'PUBLISHED';
    }
    if (query.search) where.title = { contains: query.search, mode: 'insensitive' };

    const courses = await this.prisma.course.findMany({
      where,
      include: courseInclude,
      orderBy: { createdAt: 'desc' },
    });
    return courses.map(toCourseDto);
  }

  async get(id: string, user?: AuthUser): Promise<CourseDetailDto> {
    const course = await this.prisma.course.findUnique({
      where: { id },
      include: {
        ...courseInclude,
        lessons: { orderBy: { order: 'asc' } },
        exams: {
          where: isStaff(user) ? {} : { status: 'PUBLISHED' },
          select: { id: true, title: true, durationSec: true, status: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!course || (course.status !== 'PUBLISHED' && !this.canManage(course, user))) {
      throw new NotFoundException('Không tìm thấy khóa học');
    }
    const isEnrolled = user
      ? !!(await this.prisma.enrollment.findUnique({
          where: { userId_courseId: { userId: user.id, courseId: id } },
        }))
      : false;

    return {
      ...toCourseDto(course),
      lessons: course.lessons.map(toLessonDto),
      exams: course.exams,
      isEnrolled,
    };
  }

  async create(user: AuthUser, dto: CreateCourseDto) {
    const course = await this.prisma.course.create({
      data: { ...dto, slug: slugify(dto.title), instructorId: user.id },
      include: courseInclude,
    });
    return toCourseDto(course);
  }

  async update(id: string, user: AuthUser, dto: UpdateCourseDto) {
    await this.assertCanManage(id, user);
    const course = await this.prisma.course.update({
      where: { id },
      data: dto,
      include: courseInclude,
    });
    return toCourseDto(course);
  }

  async enroll(courseId: string, user: AuthUser) {
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course || course.status !== 'PUBLISHED')
      throw new NotFoundException('Không tìm thấy khóa học');
    await this.prisma.enrollment.upsert({
      where: { userId_courseId: { userId: user.id, courseId } },
      create: { userId: user.id, courseId },
      update: {},
    });
    return { enrolled: true as const };
  }

  async addLesson(courseId: string, user: AuthUser, dto: CreateLessonDto) {
    await this.assertCanManage(courseId, user);
    const order = dto.order ?? (await this.prisma.lesson.count({ where: { courseId } }));
    const lesson = await this.prisma.lesson.create({ data: { ...dto, order, courseId } });
    return toLessonDto(lesson);
  }

  async updateLesson(lessonId: string, user: AuthUser, dto: UpdateLessonDto) {
    const lesson = await this.prisma.lesson.findUnique({ where: { id: lessonId } });
    if (!lesson) throw new NotFoundException('Không tìm thấy bài học');
    await this.assertCanManage(lesson.courseId, user);
    return toLessonDto(await this.prisma.lesson.update({ where: { id: lessonId }, data: dto }));
  }

  async deleteLesson(lessonId: string, user: AuthUser) {
    const lesson = await this.prisma.lesson.findUnique({ where: { id: lessonId } });
    if (!lesson) throw new NotFoundException('Không tìm thấy bài học');
    await this.assertCanManage(lesson.courseId, user);
    await this.prisma.lesson.delete({ where: { id: lessonId } });
    return { deleted: true as const };
  }

  /** Dùng chung cho các module khác (đề thi, ngân hàng câu hỏi, tài liệu). */
  async assertCanManage(courseId: string, user: AuthUser) {
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new NotFoundException('Không tìm thấy khóa học');
    if (!this.canManage(course, user)) {
      throw new ForbiddenException('Bạn không phụ trách khóa học này');
    }
    return course;
  }

  private canManage(course: { instructorId: string }, user?: AuthUser) {
    return !!user && (user.role === 'ADMIN' || course.instructorId === user.id);
  }
}
