import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { type AuthUser, CurrentUser, Public, Roles } from '../../common/auth.js';
import {
  CourseQueryDto,
  CreateCourseDto,
  CreateLessonDto,
  UpdateCourseDto,
  UpdateLessonDto,
} from './courses.dto.js';
import { CoursesService } from './courses.service.js';

@ApiTags('courses')
@ApiBearerAuth()
@Controller()
export class CoursesController {
  constructor(private readonly courses: CoursesService) {}

  @Public()
  @Get('courses')
  list(@CurrentUser() user: AuthUser | undefined, @Query() query: CourseQueryDto) {
    return this.courses.list(user, { mine: query.mine === 'true', search: query.search });
  }

  @Public()
  @Get('courses/:id')
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser | undefined) {
    return this.courses.get(id, user);
  }

  @Roles('INSTRUCTOR')
  @Post('courses')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCourseDto) {
    return this.courses.create(user, dto);
  }

  @Roles('INSTRUCTOR')
  @Patch('courses/:id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateCourseDto,
  ) {
    return this.courses.update(id, user, dto);
  }

  @Post('courses/:id/enroll')
  enroll(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.courses.enroll(id, user);
  }

  @Roles('INSTRUCTOR')
  @Post('courses/:id/lessons')
  addLesson(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateLessonDto,
  ) {
    return this.courses.addLesson(id, user, dto);
  }

  @Roles('INSTRUCTOR')
  @Patch('lessons/:id')
  updateLesson(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateLessonDto,
  ) {
    return this.courses.updateLesson(id, user, dto);
  }

  @Roles('INSTRUCTOR')
  @Delete('lessons/:id')
  deleteLesson(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.courses.deleteLesson(id, user);
  }
}
