import { BullModule } from '@nestjs/bullmq';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Module,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { type AuthUser, CurrentUser, Roles } from '../../common/auth.js';
import { AI_QUEUE } from '../../common/queues.js';
import { QuestionBankModule } from '../question-bank/question-bank.module.js';
import {
  DocumentQueryDto,
  ExplainAnswerDto,
  GenerateQuestionsDto,
  UploadDocumentDto,
} from './ai.dto.js';
import { AiProcessor } from './ai.processor.js';
import { AiService, MAX_PDF_BYTES } from './ai.service.js';
import { ClaudeService } from './claude.service.js';
import { EmbeddingService } from './embedding.service.js';
import { RagService } from './rag.service.js';

@ApiTags('ai')
@ApiBearerAuth()
@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Roles('INSTRUCTOR')
  @Post('documents')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['courseId', 'file'],
      properties: {
        courseId: { type: 'string', format: 'uuid' },
        title: { type: 'string' },
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_PDF_BYTES } }))
  upload(
    @CurrentUser() user: AuthUser,
    @Body() dto: UploadDocumentDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.ai.uploadDocument(user, dto.courseId, file, dto.title);
  }

  @Roles('INSTRUCTOR')
  @Get('documents')
  documents(@CurrentUser() user: AuthUser, @Query() query: DocumentQueryDto) {
    return this.ai.listDocuments(user, query.courseId);
  }

  @Roles('INSTRUCTOR')
  @Post('documents/:id/generate-questions')
  @HttpCode(202)
  generate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: GenerateQuestionsDto,
  ) {
    return this.ai.enqueueGeneration(user, id, dto);
  }

  @Roles('INSTRUCTOR')
  @Get('jobs/:id')
  job(@Param('id') id: string) {
    return this.ai.getJob(id);
  }

  @Post('explain')
  @HttpCode(200)
  explain(@CurrentUser() user: AuthUser, @Body() dto: ExplainAnswerDto) {
    return this.ai.explain(user, dto.attemptId, dto.attemptQuestionId);
  }
}

@Module({
  imports: [BullModule.registerQueue({ name: AI_QUEUE }), QuestionBankModule],
  controllers: [AiController],
  providers: [AiService, AiProcessor, ClaudeService, EmbeddingService, RagService],
  exports: [RagService, ClaudeService],
})
export class AiModule {}
