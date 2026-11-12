import {
  Difficulty,
  type ExplainAnswerInput,
  type GenerateQuestionsInput,
  QuestionType,
} from '@eduforge/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const AI_QUESTION_TYPES = [
  'SINGLE_CHOICE',
  'MULTIPLE_CHOICE',
  'TRUE_FALSE',
  'SHORT_ANSWER',
] as const;

export class UploadDocumentDto {
  @ApiProperty()
  @IsUUID()
  courseId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;
}

export class DocumentQueryDto {
  @ApiProperty()
  @IsUUID()
  courseId: string;
}

export class GenerateQuestionsDto implements GenerateQuestionsInput {
  @ApiProperty({
    description: 'Ngân hàng nhận câu hỏi (câu hỏi được lưu ở trạng thái DRAFT để duyệt)',
  })
  @IsUUID()
  bankId: string;

  @ApiProperty({ example: 10 })
  @IsInt()
  @Min(1)
  @Max(50)
  count: number;

  @ApiPropertyOptional({ enum: AI_QUESTION_TYPES, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsIn(AI_QUESTION_TYPES, { each: true })
  types?: QuestionType[];

  @ApiPropertyOptional({ enum: Difficulty })
  @IsOptional()
  @IsEnum(Difficulty)
  difficulty?: Difficulty;

  @ApiPropertyOptional({ example: 'Tập trung vào chương 2: cây nhị phân' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  instructions?: string;
}

export class ExplainAnswerDto implements ExplainAnswerInput {
  @ApiProperty()
  @IsUUID()
  attemptId: string;

  @ApiProperty()
  @IsUUID()
  attemptQuestionId: string;
}
