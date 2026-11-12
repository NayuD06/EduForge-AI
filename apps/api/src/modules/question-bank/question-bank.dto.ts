import {
  type CreateQuestionBankInput,
  type CreateQuestionInput,
  Difficulty,
  QuestionStatus,
  QuestionType,
} from '@eduforge/shared';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateQuestionBankDto implements CreateQuestionBankInput {
  @ApiProperty({ example: 'Ngân hàng câu hỏi Chương 1' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  courseId?: string;
}

export class QuestionBankQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  courseId?: string;
}

export class CreateQuestionDto implements CreateQuestionInput {
  @ApiProperty({ enum: QuestionType })
  @IsEnum(QuestionType)
  type: QuestionType;

  @ApiPropertyOptional({ enum: Difficulty })
  @IsOptional()
  @IsEnum(Difficulty)
  difficulty?: Difficulty;

  @ApiPropertyOptional({ enum: QuestionStatus })
  @IsOptional()
  @IsEnum(QuestionStatus)
  status?: QuestionStatus;

  @ApiProperty({ example: 'Độ phức tạp của tìm kiếm nhị phân là gì?' })
  @IsString()
  @MinLength(1)
  content: string;

  @ApiProperty({
    description: 'Phụ thuộc dạng câu hỏi – xem QuestionPayloadMap trong @eduforge/shared',
    example: {
      choices: [
        { id: 'a', text: 'O(n)' },
        { id: 'b', text: 'O(log n)' },
      ],
    },
  })
  @IsObject()
  options: any;

  @ApiProperty({ example: { choiceId: 'b' } })
  @IsObject()
  answer: any;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  explanation?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  points?: number;
}

export class UpdateQuestionDto extends PartialType(CreateQuestionDto) {}

export class QuestionQueryDto {
  @ApiPropertyOptional({ enum: QuestionType })
  @IsOptional()
  @IsEnum(QuestionType)
  type?: QuestionType;

  @ApiPropertyOptional({ enum: Difficulty })
  @IsOptional()
  @IsEnum(Difficulty)
  difficulty?: Difficulty;

  @ApiPropertyOptional({ enum: QuestionStatus })
  @IsOptional()
  @IsEnum(QuestionStatus)
  status?: QuestionStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tag?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}
