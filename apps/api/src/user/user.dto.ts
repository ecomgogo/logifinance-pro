import { IsEmail, IsString, IsNumber, MinLength, Max, Min, IsOptional } from 'class-validator';
import { IsIn } from 'class-validator';
import { IsObject } from 'class-validator';
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

export class ChangePasswordDto {
  @IsString()
  @MinLength(6, { message: '舊密碼至少需要 6 個字元' })
  currentPassword: string;

  @IsString()
  @MinLength(6, { message: '新密碼至少需要 6 個字元' })
  newPassword: string;

  @IsString()
  @MinLength(6, { message: '確認新密碼至少需要 6 個字元' })
  confirmPassword: string;
}

export class UpdateUserSettingsDto {
  @IsString()
  @IsIn(['HKD', 'USD', 'TWD', 'CNY'])
  baseCurrency: string;
}

export class UpdateExchangeRatesDto {
  @IsObject()
  rates: Record<string, string | null>;
}