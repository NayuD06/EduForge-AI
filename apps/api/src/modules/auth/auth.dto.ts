import type { LoginInput, RegisterInput } from '@eduforge/shared';
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto implements RegisterInput {
  @ApiProperty({ example: 'sinhvien@eduforge.dev' })
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email: string;

  @ApiProperty({ example: 'matkhau123' })
  @IsString()
  @MinLength(8, { message: 'Mật khẩu tối thiểu 8 ký tự' })
  @MaxLength(100)
  password: string;

  @ApiProperty({ example: 'Nguyễn Văn A' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName: string;
}

export class LoginDto implements LoginInput {
  @ApiProperty({ example: 'student@eduforge.dev' })
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email: string;

  @ApiProperty({ example: 'Password123!' })
  @IsString()
  password: string;
}
