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
import { type AuthUser, CurrentUser, Roles } from '../../common/auth.js';
import {
  CreateQuestionBankDto,
  CreateQuestionDto,
  QuestionBankQueryDto,
  QuestionQueryDto,
  UpdateQuestionDto,
} from './question-bank.dto.js';
import { QuestionBankService } from './question-bank.service.js';

@ApiTags('question-bank')
@ApiBearerAuth()
@Roles('INSTRUCTOR')
@Controller()
export class QuestionBankController {
  constructor(private readonly service: QuestionBankService) {}

  @Get('question-banks')
  listBanks(@CurrentUser() user: AuthUser, @Query() query: QuestionBankQueryDto) {
    return this.service.listBanks(user, query.courseId);
  }

  @Post('question-banks')
  createBank(@CurrentUser() user: AuthUser, @Body() dto: CreateQuestionBankDto) {
    return this.service.createBank(user, dto);
  }

  @Get('question-banks/:id')
  getBank(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.service.getBank(id, user);
  }

  @Get('question-banks/:id/questions')
  listQuestions(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Query() query: QuestionQueryDto,
  ) {
    return this.service.listQuestions(id, user, query);
  }

  @Post('question-banks/:id/questions')
  createQuestion(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateQuestionDto,
  ) {
    return this.service.createQuestion(id, user, dto);
  }

  @Patch('questions/:id')
  updateQuestion(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateQuestionDto,
  ) {
    return this.service.updateQuestion(id, user, dto);
  }

  @Delete('questions/:id')
  deleteQuestion(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.service.deleteQuestion(id, user);
  }
}
