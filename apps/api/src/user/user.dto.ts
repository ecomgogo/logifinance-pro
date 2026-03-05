import { IsEmail, IsString, IsNumber, MinLength, Max, Min, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateUserDto {
  @IsEmail({}, { message: '請輸入有效的 Email' })
  email: string;

  @IsString()
  @MinLength(6, { message: '密碼至少需要 6 個字元' })
  password: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  @IsOptional()
  commissionRate?: number = 0; // 抽成比例 (例如 10 代表 10%)
}