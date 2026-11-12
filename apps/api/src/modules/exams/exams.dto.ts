import {
  type CreateExamInput,
  Difficulty,
  type ExamRuleDto,
  ExamMode,
  QuestionType,
  type SaveAnswerItem,
  type SaveAnswersInput,
} from '@eduforge/shared';
import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class ExamRuleInputDto implements ExamRuleDto {
  @ApiProperty()
  @IsUUID()
  bankId: string;

  @ApiProperty({ example: 10 })
  @IsInt()
  @Min(1)
  @Max(200)
  count: number;

  @ApiPropertyOptional({ enum: QuestionType })
  @IsOptional()
  @IsEnum(QuestionType)
  type?: QuestionType;

  @ApiPropertyOptional({ enum: Difficulty })
  @IsOptional()
  @IsEnum(Difficulty)
  difficulty?: Difficulty;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  pointsPerQuestion?: number;
}

export class CreateExamDto implements CreateExamInput {
  @ApiProperty()
  @IsUUID()
  courseId: string;

  @ApiProperty({ example: 'Kiểm tra giữa kỳ' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: ExamMode })
  @IsEnum(ExamMode)
  mode: ExamMode;

  @ApiProperty({ example: 1800, description: 'Thời gian làm bài (giây)' })
  @IsInt()
  @Min(30)
  @Max(24 * 3600)
  durationSec: number;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  passingPercent?: number;

  @ApiPropertyOptional({ example: 0, description: '0 = không giới hạn' })
  @IsOptional()
  @IsInt()
  @Min(0)
  maxAttempts?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  shuffleQuestions?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  shuffleOptions?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showResult?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endAt?: string;

  @ApiPropertyOptional({ type: [ExamRuleInputDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ExamRuleInputDto)
  rules?: ExamRuleInputDto[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  questionIds?: string[];
}

export class UpdateExamDto extends PartialType(OmitType(CreateExamDto, ['courseId'] as const)) {}

export class ExamQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  courseId?: string;
}

export class SaveAnswerItemDto implements SaveAnswerItem {
  @ApiProperty()
  @IsUUID()
  attemptQuestionId: string;

  @ApiProperty({ nullable: true, example: { choiceId: 'b' } })
  @IsOptional()
  response: unknown;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  flagged?: boolean;
}

export class SaveAnswersDto implements SaveAnswersInput {
  @ApiProperty({ type: [SaveAnswerItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => SaveAnswerItemDto)
  answers: SaveAnswerItemDto[];
}
