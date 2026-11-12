import { CourseStatus, type CreateCourseInput, type CreateLessonInput } from '@eduforge/shared';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateCourseDto implements CreateCourseInput {
  @ApiProperty({ example: 'Cấu trúc dữ liệu & Giải thuật' })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_tld: false })
  coverUrl?: string;

  @ApiPropertyOptional({ enum: CourseStatus })
  @IsOptional()
  @IsEnum(CourseStatus)
  status?: CourseStatus;
}

export class UpdateCourseDto extends PartialType(CreateCourseDto) {}

export class CreateLessonDto implements CreateLessonInput {
  @ApiProperty({ example: 'Bài 1: Mảng và danh sách liên kết' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({ description: 'Nội dung Markdown' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_tld: false })
  videoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  durationMin?: number;
}

export class UpdateLessonDto extends PartialType(CreateLessonDto) {}

export class CourseQueryDto {
  @ApiPropertyOptional({ description: '"true" = chỉ khóa học do tôi phụ trách' })
  @IsOptional()
  @IsString()
  mine?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}
