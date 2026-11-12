import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { type AuthUser, CurrentUser, Roles } from '../../common/auth.js';
import { AttemptsService } from './attempts.service.js';
import { CreateExamDto, ExamQueryDto, SaveAnswersDto, UpdateExamDto } from './exams.dto.js';
import { ExamsService } from './exams.service.js';

@ApiTags('exams')
@ApiBearerAuth()
@Controller('exams')
export class ExamsController {
  constructor(
    private readonly exams: ExamsService,
    private readonly attempts: AttemptsService,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ExamQueryDto) {
    return this.exams.list(user, query.courseId);
  }

  @Roles('INSTRUCTOR')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateExamDto) {
    return this.exams.create(user, dto);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.exams.get(id, user);
  }

  @Roles('INSTRUCTOR')
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateExamDto,
  ) {
    return this.exams.update(id, user, dto);
  }

  @Roles('INSTRUCTOR')
  @Post(':id/publish')
  @HttpCode(200)
  publish(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.exams.publish(id, user);
  }

  @Roles('INSTRUCTOR')
  @Get(':id/preview')
  preview(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.exams.preview(id, user);
  }

  /** Bắt đầu hoặc tiếp tục lượt thi. */
  @Post(':id/attempts')
  start(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.attempts.start(id, user);
  }
}

@ApiTags('attempts')
@ApiBearerAuth()
@Controller('attempts')
export class AttemptsController {
  constructor(private readonly attempts: AttemptsService) {}

  @Get('mine')
  mine(@CurrentUser() user: AuthUser) {
    return this.attempts.mine(user);
  }

  @Get(':id')
  view(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.attempts.view(id, user);
  }

  /** Tự động lưu tiến trình (client gọi định kỳ hoặc khi đổi câu trả lời). */
  @Put(':id/answers')
  save(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: SaveAnswersDto,
  ) {
    return this.attempts.saveAnswers(id, user, dto);
  }

  @Post(':id/submit')
  @HttpCode(200)
  submit(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.attempts.submit(id, user);
  }

  @Get(':id/result')
  result(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.attempts.result(id, user);
  }
}
