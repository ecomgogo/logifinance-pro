import {
  IsEmail,
  IsString,
  MinLength,
  IsNotEmpty,
  Length,
  MaxLength,
} from 'class-validator';

/**
 * 租戶註冊 DTO：建立新公司（Tenant）與首位 BOSS 帳號（User）。
 */
export class RegisterTenantDto {
  /** 公司名稱 */
  @IsString()
  @IsNotEmpty({ message: '公司名稱不可為空' })
  @MaxLength(200)
  companyName!: string;

  /** 本位幣代碼，例如 HKD、TWD、USD */
  @IsString()
  @IsNotEmpty({ message: '本位幣不可為空' })
  @Length(3, 3, { message: '本位幣須為 3 碼（如 HKD、TWD）' })
  baseCurrency!: string;

  /** 登入用 Email，須為有效格式且全系統唯一 */
  @IsEmail({}, { message: '請提供有效的 Email' })
  email!: string;

  /** 密碼，至少 6 碼 */
  @IsString()
  @MinLength(6, { message: '密碼至少 6 碼' })
  password!: string;
}

/**
 * 登入 DTO：以 Email + 密碼取得 JWT。
 */
export class LoginDto {
  @IsEmail({}, { message: '請提供有效的 Email' })
  email!: string;

  @IsString()
  @IsNotEmpty({ message: '密碼不可為空' })
  password!: string;
}
